package com.smarthome.backend.server.api.modules.heos;

import com.google.gson.Gson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/**
 * Controller für die Ausführung von Aktionen auf HeosSpeaker-Geräten.
 * Verwaltet Verbindungen zu mehreren HEOS-Geräten und bietet Funktionen
 * zum Steuern von HeosSpeaker-Instanzen.
 * 
 * Der Controller ist NICHT für die Speicherung von Geräten zuständig.
 */
public class HeosController {
    private static final Logger logger = LoggerFactory.getLogger(HeosController.class);
    
    private final Map<String, Connection> connections = new ConcurrentHashMap<>();
    
    /**
     * Innere Klasse für die TCP-Kommunikation mit einem einzelnen HEOS-Gerät.
     */
    public static class Connection {
        private static final Logger logger = LoggerFactory.getLogger(Connection.class);
        
        private static final int PORT = 1255;
        private static final String DELIMITER = "\r\n";
        private static final int WATCHDOG_INTERVAL_MS = 1000;
        private static final int SEND_TIMEOUT_MS = 50000;
        private static final int CONNECT_TIMEOUT_MS = 60000;
        
        private String address;
        private boolean debug;
        private String state = "disconnected";
        
        private Socket socket;
        private BufferedReader reader;
        private PrintWriter writer;
        private java.io.OutputStream outputStream;
        
        private final Queue<QueueItem> sendQueue = new ConcurrentLinkedQueue<>();
        private QueueItem currentSendQueueItem;
        private final StringBuilder rxBuffer = new StringBuilder();
        
        private ScheduledExecutorService executorService;
        private ScheduledFuture<?> watchdogTask;
        private CompletableFuture<Void> connectPromise;
        private CompletableFuture<Void> disconnectPromise;
        private CompletableFuture<Void> reconnectPromise;
        private CompletableFuture<Void> watchdogPromise;
        
        private final List<Consumer<String>> stateListeners = new CopyOnWriteArrayList<>();
        private final List<Consumer<Map<String, Object>>> eventListeners = new CopyOnWriteArrayList<>();
        
        /**
         * Repräsentiert ein Element in der Sendewarteschlange.
         */
        private static class QueueItem {
            String command;
            Map<String, Object> queryParams;
            CompletableFuture<Map<String, Object>> promise;
            
            QueueItem(String command, Map<String, Object> queryParams, CompletableFuture<Map<String, Object>> promise) {
                this.command = command;
                this.queryParams = queryParams;
                this.promise = promise;
            }
        }
        
        public Connection(String address) {
            this.address = address;
            this.debug = "1".equals(System.getenv("HEOS_DEBUG"));
        }
        
        private void debug(String message, Object... args) {
            if (debug) {
                logger.debug("[Debug] [{}] {}", new Date(), String.format(message, args));
            }
        }
        
        public void setAddress(String address) {
            if (!address.equals(this.address)) {
                String oldAddress = this.address;
                this.address = address;
                debug("Address changed from %s to %s", oldAddress, address);
            }
        }
        
        public String getAddress() {
            return address;
        }
        
        public String getState() {
            return state;
        }
        
        /**
         * Verbindet mit dem HEOS-Gerät.
         */
        public CompletableFuture<Void> connect() {
            debug("connect()");
            return connectInternal();
        }
        
        private CompletableFuture<Void> connectInternal() {
            debug("_connect()");
            
            if ("connected".equals(state)) {
                return CompletableFuture.completedFuture(null);
            }
            
            if ("connecting".equals(state)) {
                return connectPromise != null ? connectPromise : CompletableFuture.completedFuture(null);
            }
            
            if ("disconnecting".equals(state)) {
                try {
                    if (disconnectPromise != null) {
                        disconnectPromise.get();
                    }
                    Thread.sleep(10);
                } catch (Exception e) {
                    // Ignoriere Fehler
                }
            }
            
            connectPromise = new CompletableFuture<>();
            setState("connecting");
            
            executorService = Executors.newScheduledThreadPool(2);
            
            try {
                socket = new Socket();
                socket.setSoTimeout(60000); // Erhöht auf 60 Sekunden für langsamere Geräte
                socket.setTcpNoDelay(true); // Deaktiviert Nagle-Algorithmus für sofortiges Senden
                socket.setKeepAlive(true); // Keep-Alive aktivieren
                socket.connect(new java.net.InetSocketAddress(address, PORT), CONNECT_TIMEOUT_MS);
                
                debug("Socket connected to %s:%d", address, PORT);
                
                // Hole OutputStream direkt für zuverlässigeres Senden
                outputStream = socket.getOutputStream();
                reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                writer = new PrintWriter(new OutputStreamWriter(outputStream, StandardCharsets.UTF_8), true);
                
                // Starte Empfangsthread
                Thread receiveThread = new Thread(this::receiveLoop);
                receiveThread.setDaemon(true);
                receiveThread.setName("heos-receive-" + address);
                receiveThread.start();
                
                // Warte länger, damit der Empfangsthread bereit ist und das Gerät initialisiert ist
                // HEOS-Geräte benötigen manchmal etwas Zeit, um bereit zu sein
                Thread.sleep(500);
                
                // Prüfe, ob die Verbindung noch aktiv ist
                if (socket == null || socket.isClosed()) {
                    throw new Exception("Socket wurde während der Initialisierung geschlossen");
                }
                
                // Registriere für Change Events
                systemRegisterForChangeEvents(true)
                    .thenRun(() -> {
                        debug("Socket connected");
                        connectPromise.complete(null);
                        connectPromise = null;
                        setState("connected");
                        
                        // Starte Watchdog
                        if (watchdogTask == null) {
                            watchdogTask = executorService.scheduleAtFixedRate(
                                this::onWatchdog,
                                WATCHDOG_INTERVAL_MS,
                                WATCHDOG_INTERVAL_MS,
                                TimeUnit.MILLISECONDS
                            );
                        }
                    })
                    .exceptionally(err -> {
                        debug("Socket connect error: %s", err.getMessage());
                        connectPromise.completeExceptionally(err);
                        connectPromise = null;
                        disconnect();
                        return null;
                    });
                
            } catch (Exception e) {
                logger.error("Connection error to {}:{} - {}", address, PORT, e.getMessage(), e);
                debug("Connection error: %s", e.getMessage());
                CompletableFuture<Void> errorPromise;
                if (connectPromise != null) {
                    connectPromise.completeExceptionally(e);
                    errorPromise = connectPromise;
                } else {
                    // Erstelle ein neues CompletableFuture mit Exception
                    errorPromise = new CompletableFuture<>();
                    errorPromise.completeExceptionally(e);
                }
                connectPromise = null;
                setState("disconnected");
                
                // Bereinige Ressourcen
                try {
                    if (socket != null && !socket.isClosed()) {
                        socket.close();
                    }
                } catch (IOException ioEx) {
                    // Ignoriere
                }
                socket = null;
                reader = null;
                writer = null;
                outputStream = null;
                
                // Stelle sicher, dass immer ein CompletableFuture zurückgegeben wird
                return errorPromise;
            }
            
            // Stelle sicher, dass immer ein CompletableFuture zurückgegeben wird
            return connectPromise != null ? connectPromise : CompletableFuture.completedFuture(null);
        }
        
        /**
         * Trennt die Verbindung zum HEOS-Gerät.
         */
        public CompletableFuture<Void> disconnect() {
            debug("disconnect()");
            
            try {
                if (watchdogTask != null) {
                    watchdogTask.cancel(false);
                    watchdogTask = null;
                }
                
                CompletableFuture<Void> result = disconnectInternal();
                // Stelle sicher, dass immer ein CompletableFuture zurückgegeben wird
                return result != null ? result : CompletableFuture.completedFuture(null);
            } catch (Exception e) {
                logger.error("Fehler beim Disconnect", e);
                // Stelle sicher, dass immer ein CompletableFuture zurückgegeben wird
                return CompletableFuture.completedFuture(null);
            }
        }
        
        private CompletableFuture<Void> disconnectInternal() {
            debug("_disconnect()");
            
            try {
                if ("disconnected".equals(state)) {
                    return CompletableFuture.completedFuture(null);
                }
                
                if ("disconnecting".equals(state)) {
                    return disconnectPromise != null ? disconnectPromise : CompletableFuture.completedFuture(null);
                }
                
                if ("connecting".equals(state)) {
                    try {
                        if (connectPromise != null) {
                            connectPromise.get();
                        }
                    } catch (Exception e) {
                        // Ignoriere Fehler
                    }
                }
                
                setState("disconnecting");
                
                CompletableFuture<Void> localDisconnectPromise = new CompletableFuture<>();
                disconnectPromise = localDisconnectPromise;
                
                try {
                    if (socket != null && !socket.isClosed()) {
                        socket.close();
                    }
                } catch (Exception e) {
                    logger.error("Fehler beim Schließen des Sockets", e);
                } finally {
                    socket = null;
                    reader = null;
                    writer = null;
                    outputStream = null;
                    localDisconnectPromise.complete(null);
                    setState("disconnected");
                }
                
                // Stelle sicher, dass immer ein CompletableFuture zurückgegeben wird
                // Verwende localDisconnectPromise, da disconnectPromise möglicherweise von einem anderen Thread geändert wurde
                disconnectPromise = null;
                return localDisconnectPromise;
            } catch (Exception e) {
                logger.error("Unerwarteter Fehler in disconnectInternal()", e);
                // Stelle sicher, dass immer ein CompletableFuture zurückgegeben wird
                return CompletableFuture.completedFuture(null);
            }
        }
        
        /**
         * Verbindet erneut mit dem HEOS-Gerät.
         */
        public CompletableFuture<Void> reconnect() {
            debug("reconnect()");
            
            if (reconnectPromise != null) {
                return reconnectPromise;
            }
            
            reconnectPromise = CompletableFuture.runAsync(() -> {
                try {
                    notifyStateListeners("reconnecting");
                    CompletableFuture<Void> disconnectFuture = disconnectInternal();
                    if (disconnectFuture != null) {
                        disconnectFuture.get();
                    }
                    Thread.sleep(100);
                    CompletableFuture<Void> connectFuture = connectInternal();
                    if (connectFuture != null) {
                        connectFuture.get();
                    }
                    notifyStateListeners("reconnected");
                    reconnectPromise = null;
                } catch (Exception e) {
                    notifyStateListeners("reconnect_error");
                    reconnectPromise = null;
                    throw new RuntimeException(e);
                }
            });
            
            return reconnectPromise;
        }
        
        private void setState(String newState) {
            this.state = newState;
            notifyStateListeners(newState);
            notifyStateListeners("state");
        }
        
        private void notifyStateListeners(String state) {
            for (Consumer<String> listener : stateListeners) {
                try {
                    listener.accept(state);
                } catch (Exception e) {
                    logger.error("Fehler beim Benachrichtigen des State-Listeners", e);
                }
            }
        }
        
        public void addStateListener(Consumer<String> listener) {
            stateListeners.add(listener);
        }
        
        public void addEventListener(Consumer<Map<String, Object>> listener) {
            eventListeners.add(listener);
        }
        
        /**
         * Watchdog zur Überprüfung der Verbindung.
         */
        private void onWatchdog() {
            if (watchdogPromise != null) {
                return;
            }
            
            if ("connecting".equals(state) || "disconnecting".equals(state)) {
                return;
            }
            
            debug("Watchdog testing connection");
            
            watchdogPromise = playerGetPlayers()
                .thenRun(() -> {
                    debug("Watchdog OK");
                    watchdogPromise = null;
                })
                .exceptionally(err -> {
                    notifyStateListeners("watchdog_error");
                    debug("Watchdog error: %s", err.getMessage());
                    reconnect()
                        .thenRun(() -> {
                            debug("Watchdog reconnected");
                            watchdogPromise = null;
                        })
                        .exceptionally(reconnectErr -> {
                            debug("Watchdog reconnect error: %s", reconnectErr.getMessage());
                            watchdogPromise = null;
                            return null;
                        });
                    return null;
                });
        }
        
        /**
         * Empfangsschleife für eingehende Nachrichten.
         */
        private void receiveLoop() {
            try {
                char[] buffer = new char[4096];
                int bytesRead;
                
                while (!"disconnected".equals(state) && !Thread.currentThread().isInterrupted()) {
                    try {
                        bytesRead = reader.read(buffer, 0, buffer.length);
                        if (bytesRead == -1) {
                            // Stream geschlossen
                            debug("Receive loop: Stream closed (EOF)");
                            break;
                        }
                        if (bytesRead > 0) {
                            String received = new String(buffer, 0, bytesRead);
                            debug("Receive loop: Received %d bytes: %s", bytesRead, received);
                            rxBuffer.append(received);
                            parseRxBuffer();
                        }
                    } catch (SocketTimeoutException e) {
                        // Timeout ist normal, weiter machen
                        continue;
                    }
                }
            } catch (Exception e) {
                if (!"disconnected".equals(state)) {
                    logger.error("Fehler beim Empfangen von Daten", e);
                }
            } finally {
                debug("Receive loop: Exiting");
                if (socket != null && !socket.isClosed()) {
                    try {
                        socket.close();
                    } catch (IOException e) {
                        // Ignoriere
                    }
                }
                if (!"disconnected".equals(state)) {
                    setState("disconnected");
                }
            }
        }
        
        /**
         * Verarbeitet den Empfangspuffer.
         */
        private void parseRxBuffer() {
            String buffer = rxBuffer.toString();
            String[] parts = buffer.split(DELIMITER, 2);
            
            if (parts.length > 1) {
                String message = parts[0];
                rxBuffer.setLength(0);
                rxBuffer.append(parts.length > 1 ? parts[1] : "");
                
                try {
                    Map<String, Object> response = parseResponse(message);
                    
                    String command = (String) response.get("command");
                    if (command != null && command.startsWith("event/")) {
                        String event = command.replace("event/", "");
                        Map<String, Object> eventData = (Map<String, Object>) response.get("message");
                        
                        for (Consumer<Map<String, Object>> listener : eventListeners) {
                            try {
                                listener.accept(eventData);
                            } catch (Exception e) {
                                logger.error("Fehler beim Benachrichtigen des Event-Listeners", e);
                            }
                        }
                    } else {
                        if (currentSendQueueItem != null) {
                            QueueItem item = currentSendQueueItem;
                            currentSendQueueItem = null;
                            
                            if (response.containsKey("error")) {
                                item.promise.completeExceptionally(
                                    new RuntimeException((String) response.get("error"))
                                );
                            } else {
                                item.promise.complete(response);
                            }
                            
                            nextSendQueueItem();
                        }
                    }
                    
                    // Rekursiv weiter verarbeiten
                    if (rxBuffer.length() > 0) {
                        parseRxBuffer();
                    }
                } catch (Exception e) {
                    logger.error("Fehler beim Parsen der Antwort", e);
                }
            }
        }
        
        /**
         * Decodiert rekursiv alle String-Werte in einem Objekt (Map, List, String).
         */
        @SuppressWarnings("unchecked")
        private Object decodeHeosObject(Object obj) {
            if (obj == null) {
                return null;
            }
            
            if (obj instanceof String) {
                return decodeHeosValue((String) obj);
            } else if (obj instanceof Map) {
                Map<String, Object> map = (Map<String, Object>) obj;
                Map<String, Object> decodedMap = new HashMap<>();
                for (Map.Entry<String, Object> entry : map.entrySet()) {
                    decodedMap.put(entry.getKey(), decodeHeosObject(entry.getValue()));
                }
                return decodedMap;
            } else if (obj instanceof List) {
                List<Object> list = (List<Object>) obj;
                List<Object> decodedList = new ArrayList<>();
                for (Object item : list) {
                    decodedList.add(decodeHeosObject(item));
                }
                return decodedList;
            }
            
            return obj;
        }
        
        /**
         * Parst eine HEOS-Antwort.
         * HEOS sendet JSON-Antworten im Format: {"heos": {"command": "...", "result": "...", "message": "..."}}
         * Decodiert spezielle Zeichen in allen String-Werten gemäß HEOS-Protokoll.
         */
        @SuppressWarnings("unchecked")
        private Map<String, Object> parseResponse(String message) {
            Map<String, Object> result = new HashMap<>();
            
            try {
                // HEOS sendet JSON-Antworten
                Gson gson = new Gson();
                Map<String, Object> jsonResponse = gson.fromJson(message, Map.class);
                
                if (jsonResponse != null && jsonResponse.containsKey("heos")) {
                    Map<String, Object> heosData = (Map<String, Object>) jsonResponse.get("heos");
                    
                    String command = (String) heosData.get("command");
                    String heosResult = (String) heosData.get("result");
                    String heosMessage = (String) heosData.get("message");
                    
                    // Decodiere String-Werte
                    command = decodeHeosValue(command);
                    heosResult = decodeHeosValue(heosResult);
                    heosMessage = decodeHeosValue(heosMessage);
                    
                    result.put("command", command);
                    result.put("result", heosResult);
                    
                    if ("fail".equals(heosResult)) {
                        // Parse error message
                        Map<String, Object> messageMap = parseQueryString(heosMessage);
                        result.put("message", messageMap);
                        result.put("error", messageMap.getOrDefault("text", "Unknown Heos Error"));
                    } else {
                        // Parse success message
                        Map<String, Object> messageMap = parseQueryString(heosMessage);
                        result.put("message", messageMap);
                        
                        // Extract payload if present and decode it
                        if (jsonResponse.containsKey("payload")) {
                            Object payload = jsonResponse.get("payload");
                            result.put("payload", decodeHeosObject(payload));
                        }
                    }
                } else {
                    // Fallback: Versuche als Query-String zu parsen
                    String[] parts = message.split("\\?", 2);
                    String command = parts[0];
                    result.put("command", decodeHeosValue(command));
                    
                    if (parts.length > 1) {
                        String params = parts[1];
                        Map<String, Object> messageMap = parseQueryString(params);
                        result.put("message", messageMap);
                    }
                }
            } catch (Exception e) {
                logger.error("Fehler beim Parsen der HEOS-Antwort: " + message, e);
                result.put("error", "Parse error: " + e.getMessage());
            }
            
            return result;
        }
        
        /**
         * Parst einen Query-String.
         * Decodiert spezielle Zeichen in den Werten gemäß HEOS-Protokoll.
         */
        private Map<String, Object> parseQueryString(String queryString) {
            Map<String, Object> result = new HashMap<>();
            
            if (queryString == null || queryString.isEmpty()) {
                return result;
            }
            
            String[] pairs = queryString.split("&");
            for (String pair : pairs) {
                String[] keyValue = pair.split("=", 2);
                if (keyValue.length == 2) {
                    String key = keyValue[0];
                    String value = keyValue[1].replace("'", "");
                    // Decodiere den Wert
                    value = decodeHeosValue(value);
                    result.put(key, value);
                }
            }
            
            return result;
        }
        
        /**
         * Sendet den nächsten Befehl aus der Warteschlange.
         */
        private void nextSendQueueItem() {
            if (currentSendQueueItem != null) {
                return;
            }
            
            currentSendQueueItem = sendQueue.poll();
            if (currentSendQueueItem == null) {
                return;
            }
            
            try {
                write(currentSendQueueItem.command, currentSendQueueItem.queryParams);
            } catch (Exception e) {
                logger.error("Fehler beim Senden des Befehls", e);
                currentSendQueueItem.promise.completeExceptionally(e);
                currentSendQueueItem = null;
                nextSendQueueItem();
            }
        }
        
        /**
         * Schreibt einen Befehl an das Gerät.
         */
        private void write(String command, Map<String, Object> queryParams) {
            debug("_write() command=%s, qs=%s", command, queryParams);
            
            if (socket == null || socket.isClosed() || outputStream == null) {
                throw new IllegalStateException("not_connected");
            }
            
            StringBuilder data = new StringBuilder("heos://");
            data.append(command);
            data.append("?");
            data.append(buildQueryString(queryParams));
            data.append(DELIMITER);
            
            try {
                // Verwende OutputStream direkt für zuverlässigeres Senden
                byte[] bytes = data.toString().getBytes(StandardCharsets.UTF_8);
                outputStream.write(bytes);
                outputStream.flush();
                
                if (debug) {
                    logger.debug("Sent: {}", data.toString().trim());
                }
            } catch (Exception e) {
                logger.error("Fehler beim Senden des Befehls: {}", e.getMessage());
                throw new RuntimeException("Failed to send command", e);
            }
        }
        
        /**
         * Encodiert spezielle Zeichen für HEOS-Protokoll: '&' -> '%26', '=' -> '%3D', '%' -> '%25'
         * Prüft, ob der String bereits encodierte Zeichen enthält, um Doppel-Encoding zu vermeiden.
         * Laut HEOS-Dokumentation werden meist bereits encodierte Strings aus Responses verwendet.
         */
        private String encodeHeosValue(String value) {
            if (value == null) {
                return null;
            }
            
            // Prüfe, ob bereits encodierte Sequenzen vorhanden sind
            // Wenn ja, nehmen wir an, dass der String bereits vollständig encodiert ist
            if (value.contains("%26") || value.contains("%3D") || value.contains("%25")) {
                return value;
            }
            
            // Encodiere nur nicht-encodierte Zeichen
            // Verwende StringBuilder für bessere Performance bei langen Strings
            StringBuilder sb = new StringBuilder(value.length() * 2);
            for (int i = 0; i < value.length(); i++) {
                char c = value.charAt(i);
                switch (c) {
                    case '%':
                        sb.append("%25");
                        break;
                    case '&':
                        sb.append("%26");
                        break;
                    case '=':
                        sb.append("%3D");
                        break;
                    default:
                        sb.append(c);
                        break;
                }
            }
            return sb.toString();
        }
        
        /**
         * Decodiert spezielle Zeichen für HEOS-Protokoll: '%26' -> '&', '%3D' -> '=', '%25' -> '%'
         */
        private String decodeHeosValue(String value) {
            if (value == null) {
                return null;
            }
            // Decodiere in umgekehrter Reihenfolge, um Doppel-Decodierung zu vermeiden
            return value.replace("%26", "&")
                       .replace("%3D", "=")
                       .replace("%25", "%");
        }
        
        /**
         * Baut einen Query-String aus Parametern.
         * Encodiert spezielle Zeichen in den Werten gemäß HEOS-Protokoll.
         */
        private String buildQueryString(Map<String, Object> params) {
            if (params == null || params.isEmpty()) {
                return "";
            }
            
            StringBuilder sb = new StringBuilder();
            boolean first = true;
            
            for (Map.Entry<String, Object> entry : params.entrySet()) {
                if (!first) {
                    sb.append("&");
                }
                sb.append(entry.getKey());
                sb.append("=");
                String value = entry.getValue() != null ? entry.getValue().toString() : "";
                // Encodiere den Wert (Keys müssen nicht encodiert werden)
                sb.append(encodeHeosValue(value));
                first = false;
            }
            
            return sb.toString();
        }
        
        /**
         * Sendet einen Befehl an das Gerät.
         */
        public CompletableFuture<Map<String, Object>> send(String command, Map<String, Object> queryParams) {
            debug("send() command=%s, qs=%s", command, queryParams);
            
            CompletableFuture<Map<String, Object>> promise = new CompletableFuture<>();
            QueueItem item = new QueueItem(command, queryParams != null ? queryParams : new HashMap<>(), promise);
            
            sendQueue.offer(item);
            nextSendQueueItem();
            
            // Timeout
            executorService.schedule(() -> {
                if (!promise.isDone()) {
                    promise.completeExceptionally(new TimeoutException("Send Timeout"));
                }
            }, SEND_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            
            return promise.thenApply(result -> {
                currentSendQueueItem = null;
                nextSendQueueItem();
                return result;
            }).exceptionally(err -> {
                currentSendQueueItem = null;
                nextSendQueueItem();
                throw new RuntimeException(err);
            });
        }
        
        // System Commands
        
        private CompletableFuture<Map<String, Object>> systemRegisterForChangeEvents(boolean enabled) {
            Map<String, Object> params = new HashMap<>();
            params.put("enable", enabled ? "on" : "off");
            return send("system/register_for_change_events", params);
        }
        
        // Player Commands
        
        @SuppressWarnings("unchecked")
        public CompletableFuture<List<Map<String, Object>>> playerGetPlayers() {
            return send("player/get_players", new HashMap<>())
                .thenApply(result -> {
                    Object payload = result.get("payload");
                    if (payload instanceof List) {
                        return (List<Map<String, Object>>) payload;
                    }
                    return new ArrayList<>();
                });
        }
        
        @SuppressWarnings("unchecked")
        public CompletableFuture<Map<String, Object>> playerGetPlayerInfo(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/get_player_info", params)
                .thenApply(result -> {
                    Object payload = result.get("payload");
                    if (payload instanceof Map) {
                        return (Map<String, Object>) payload;
                    }
                    return new HashMap<>();
                });
        }
        
        public CompletableFuture<String> playerGetPlayState(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/get_play_state", params)
                .thenApply(result -> {
                    Map<String, Object> message = (Map<String, Object>) result.get("message");
                    return message != null ? (String) message.get("state") : "stop";
                });
        }
        
        public CompletableFuture<Void> playerSetPlayState(int pid, String state) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("state", state);
            return send("player/set_play_state", params).thenApply(r -> null);
        }
        
        @SuppressWarnings("unchecked")
        public CompletableFuture<Map<String, Object>> playerGetNowPlayingMedia(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/get_now_playing_media", params)
                .thenApply(result -> {
                    Object payload = result.get("payload");
                    if (payload instanceof Map) {
                        return (Map<String, Object>) payload;
                    }
                    return new HashMap<>();
                });
        }
        
        public CompletableFuture<Integer> playerGetVolume(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            
            logger.info("playerGetVolume Request: command=player/get_volume, params={}", params);
            
            return send("player/get_volume", params)
                .thenApply(result -> {
                    logger.info("playerGetVolume Response: result={}", result);
                    
                    Map<String, Object> message = (Map<String, Object>) result.get("message");
                    if (message != null && message.containsKey("level")) {
                        try {
                            int volume = Integer.parseInt(message.get("level").toString());
                            logger.debug("playerGetVolume: Extracted volume={} from message={}", volume, message);
                            return volume;
                        } catch (NumberFormatException e) {
                            logger.warn("playerGetVolume: Failed to parse volume level from message={}, error={}", message, e.getMessage());
                            return 0;
                        }
                    }
                    return 0;
                })
                .exceptionally(e -> {
                    logger.error("playerGetVolume: Error getting volume for pid={}", pid, e);
                    return 0;
                });
        }
        
        public CompletableFuture<Void> playerSetVolume(int pid, int level) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("level", level);
            return send("player/set_volume", params).thenApply(r -> null);
        }
        
        public CompletableFuture<Boolean> playerGetMute(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/get_mute", params)
                .thenApply(result -> {
                    Map<String, Object> message = (Map<String, Object>) result.get("message");
                    if (message != null) {
                        String state = (String) message.get("state");
                        return "on".equals(state);
                    }
                    return false;
                });
        }
        
        public CompletableFuture<Void> playerSetMute(int pid, boolean mute) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("state", mute ? "on" : "off");
            return send("player/set_mute", params).thenApply(r -> null);
        }
        
        public CompletableFuture<Void> playerPlayNext(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/play_next", params).thenApply(r -> null);
        }
        
        public CompletableFuture<Void> playerPlayPrevious(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/play_previous", params).thenApply(r -> null);
        }
        
        public CompletableFuture<Void> playerPlayPreset(int pid, int preset) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("preset", preset);
            return send("player/play_preset", params).thenApply(r -> null);
        }
        
        public CompletableFuture<String> playerGetPlayMode(int pid) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            return send("player/get_play_mode", params)
                .thenApply(result -> {
                    Map<String, Object> message = (Map<String, Object>) result.get("message");
                    return message != null ? (String) message.get("mode") : "off";
                });
        }
        
        public CompletableFuture<Void> playerSetPlayMode(int pid, boolean shuffle, String repeat) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("shuffle", shuffle ? "on" : "off");
            params.put("repeat", repeat); // on_all, on_one, off
            return send("player/set_play_mode", params).thenApply(r -> null);
        }
        
        // Browse Commands
        
        @SuppressWarnings("unchecked")
        public CompletableFuture<List<Map<String, Object>>> browseGetMusicSources() {
            return send("browse/get_music_sources", new HashMap<>())
                .thenApply(result -> {
                    Object payload = result.get("payload");
                    if (payload instanceof List) {
                        return (List<Map<String, Object>>) payload;
                    }
                    return new ArrayList<>();
                });
        }
        
        public CompletableFuture<Void> browsePlayStream(int pid, int sid, int mid, int spid, String input) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("sid", sid);
            params.put("mid", mid);
            params.put("spid", spid);
            params.put("input", input);
            return send("browse/play_stream", params).thenApply(r -> null);
        }
        
        public CompletableFuture<Void> browsePlayInput(int pid, String input) {
            Map<String, Object> params = new HashMap<>();
            params.put("pid", pid);
            params.put("input", input);
            return send("browse/play_input", params).thenApply(r -> null);
        }
        
        public CompletableFuture<Void> browsePlayAuxIn1(int pid) {
            return browsePlayInput(pid, "inputs/aux_in_1");
        }
    }
    
    /**
     * Ruft eine Verbindung zu einem Gerät ab oder erstellt eine neue.
     */
    private CompletableFuture<Connection> getConnectionTo(String address) {
        Connection connection = connections.get(address);
        
        if (connection != null) {
            return connection.reconnect()
                .thenApply(v -> connection);
        }
        
        return createConnection(address);
    }
    
    /**
     * Erstellt eine neue Verbindung zu einem Gerät.
     */
    private CompletableFuture<Connection> createConnection(String address) {
        Connection connection = new Connection(address);
        
        // Listener für Disconnect-Ereignis
        connection.addStateListener(state -> {
            if ("disconnected".equals(state)) {
                connections.remove(address);
            }
        });
        
        return connection.connect()
            .thenApply(v -> {
                connections.put(address, connection);
                return connection;
            });
    }
    
    /**
     * Erstellt eine temporäre Verbindung für Discovery-Zwecke.
     * Diese Verbindung wird nicht in der connections-Map gespeichert.
     */
    public Connection createTemporaryConnection(String address) {
        return new Connection(address);
    }
    
    
    /**
     * Setzt die Lautstärke eines HeosSpeakers.
     * 
     * @param speaker Der HeosSpeaker
     * @param volume Die Lautstärke (0-100)
     * @return CompletableFuture, das abgeschlossen wird, wenn die Lautstärke gesetzt wurde
     */
    public CompletableFuture<Void> setVolume(HeosSpeaker speaker, int volume) {
        logger.debug("Setze Lautstärke für Speaker {} auf {}", speaker.getName(), volume);
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerSetVolume(speaker.getPid(), volume))
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen der Lautstärke für Speaker {}", speaker.getName(), e);
                return null;
            });
    }
    
    /**
     * Ruft die aktuelle Lautstärke eines HeosSpeakers ab.
     * 
     * @param speaker Der HeosSpeaker
     * @return CompletableFuture mit der aktuellen Lautstärke (0-100)
     */
    public CompletableFuture<Integer> getVolume(HeosSpeaker speaker) {
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerGetVolume(speaker.getPid()))
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen der Lautstärke für Speaker {}", speaker.getName(), e);
                return 0;
            });
    }
    
    /**
     * Setzt den Wiedergabestatus eines HeosSpeakers.
     * 
     * @param speaker Der HeosSpeaker
     * @param state Der Wiedergabestatus ("play", "pause" oder "stop")
     * @return CompletableFuture, das abgeschlossen wird, wenn der Status gesetzt wurde
     */
    public CompletableFuture<Void> setPlayState(HeosSpeaker speaker, String state) {
        logger.debug("Setze Wiedergabestatus für Speaker {} auf {}", speaker.getName(), state);
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerSetPlayState(speaker.getPid(), state))
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen des Wiedergabestatus für Speaker {}", speaker.getName(), e);
                return null;
            });
    }
    
    /**
     * Ruft den aktuellen Wiedergabestatus eines HeosSpeakers ab.
     * 
     * @param speaker Der HeosSpeaker
     * @return CompletableFuture mit dem Wiedergabestatus ("play", "pause" oder "stop")
     */
    public CompletableFuture<String> getPlayState(HeosSpeaker speaker) {
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerGetPlayState(speaker.getPid()))
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen des Wiedergabestatus für Speaker {}", speaker.getName(), e);
                return "stop";
            });
    }
    
    /**
     * Spielt ein bestimmtes Lied/URL auf einem HeosSpeaker ab.
     * 
     * @param speaker Der HeosSpeaker
     * @param url Die URL des Liedes/Streams
     * @return CompletableFuture, das abgeschlossen wird, wenn das Lied abgespielt wird
     */
    public CompletableFuture<Void> playSong(HeosSpeaker speaker, String url) {
        logger.debug("Spiele Lied auf Speaker {} ab: {}", speaker.getName(), url);
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.browsePlayInput(speaker.getPid(), url))
            .exceptionally(e -> {
                logger.error("Fehler beim Abspielen des Liedes auf Speaker {}", speaker.getName(), e);
                return null;
            });
    }
    
    /**
     * Konvertiert Text zu Sprache und spielt diesen auf einem HeosSpeaker ab.
     * 
     * @param speaker Der HeosSpeaker
     * @param text Der zu sprechende Text
     * @return CompletableFuture, das abgeschlossen wird, wenn der Text abgespielt wird
     */
    public CompletableFuture<Void> playTextAsSpeech(HeosSpeaker speaker, String text) {
        logger.debug("Spiele Text-zu-Sprache auf Speaker {} ab: {}", speaker.getName(), text);
        // TODO: Implementierung für Text-to-Speech
        // Dies würde eine externe TTS-API benötigen, um den Text in eine Audio-URL umzuwandeln
        // Dann würde die Audio-URL über playSong() abgespielt werden
        logger.warn("playTextAsSpeech() ist noch nicht vollständig implementiert - benötigt TTS-API");
        String url = "";
        return playSong(speaker, url);
    }
    
    /**
     * Setzt die Stummschaltung eines HeosSpeakers.
     * 
     * @param speaker Der HeosSpeaker
     * @param mute true für stumm, false für nicht stumm
     * @return CompletableFuture, das abgeschlossen wird, wenn die Stummschaltung gesetzt wurde
     */
    public CompletableFuture<Void> setMute(HeosSpeaker speaker, boolean mute) {
        logger.debug("Setze Stummschaltung für Speaker {} auf {}", speaker.getName(), mute);
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerSetMute(speaker.getPid(), mute))
            .exceptionally(e -> {
                logger.error("Fehler beim Setzen der Stummschaltung für Speaker {}", speaker.getName(), e);
                return null;
            });
    }
    
    /**
     * Ruft den Stummschaltungsstatus eines HeosSpeakers ab.
     * 
     * @param speaker Der HeosSpeaker
     * @return CompletableFuture mit true wenn stumm, false sonst
     */
    public CompletableFuture<Boolean> getMute(HeosSpeaker speaker) {
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerGetMute(speaker.getPid()))
            .exceptionally(e -> {
                logger.error("Fehler beim Abrufen der Stummschaltung für Speaker {}", speaker.getName(), e);
                return false;
            });
    }
    
    /**
     * Spielt den nächsten Titel auf einem HeosSpeaker ab.
     * 
     * @param speaker Der HeosSpeaker
     * @return CompletableFuture, das abgeschlossen wird, wenn der nächste Titel abgespielt wird
     */
    public CompletableFuture<Void> playNext(HeosSpeaker speaker) {
        logger.debug("Spiele nächsten Titel auf Speaker {} ab", speaker.getName());
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerPlayNext(speaker.getPid()))
            .exceptionally(e -> {
                logger.error("Fehler beim Abspielen des nächsten Titels auf Speaker {}", speaker.getName(), e);
                return null;
            });
    }
    
    /**
     * Spielt den vorherigen Titel auf einem HeosSpeaker ab.
     * 
     * @param speaker Der HeosSpeaker
     * @return CompletableFuture, das abgeschlossen wird, wenn der vorherige Titel abgespielt wird
     */
    public CompletableFuture<Void> playPrevious(HeosSpeaker speaker) {
        logger.debug("Spiele vorherigen Titel auf Speaker {} ab", speaker.getName());
        return getConnectionTo(speaker.getAddress())
            .thenCompose(connection -> connection.playerPlayPrevious(speaker.getPid()))
            .exceptionally(e -> {
                logger.error("Fehler beim Abspielen des vorherigen Titels auf Speaker {}", speaker.getName(), e);
                return null;
            });
    }
    
    /**
     * Trennt alle Verbindungen.
     */
    public void disconnectAll() {
        for (Map.Entry<String, Connection> entry : connections.entrySet()) {
            try {
                entry.getValue().disconnect();
            } catch (Exception e) {
                logger.error("Fehler beim Trennen der Verbindung zu " + entry.getKey(), e);
            }
        }
        connections.clear();
    }
}
