package com.smarthome.backend.model;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.google.gson.annotations.SerializedName;
import com.smarthome.backend.model.devices.Device;
import com.smarthome.backend.server.actions.ActionRunnable;

import lombok.Data;

/**
 * Repräsentiert eine Aktion mit Workflow-Konfiguration, die ausgelöst werden kann.
 */
@Data
public class Action {
    private static final Logger logger = LoggerFactory.getLogger(Action.class);
    
    /**
     * Executor-Service für asynchrone Ausführung von Actions.
     */
    private static final ExecutorService actionExecutor = Executors.newCachedThreadPool();
    
    /**
     * Flag, das anzeigt, ob die Action gerade ausgeführt wird.
     * Verhindert, dass die Action erneut ausgelöst wird, während sie bereits läuft.
     */
    private volatile boolean isExecuting = false;
    
    @SerializedName("actionId")
    private String actionId;
    
    private String name;
    
    @SerializedName("triggerType")
    private String triggerType; // 'manual' | 'device' | 'time'
    
    private Workflow workflow;
    
    @SerializedName("createdAt")
    private String createdAt; // ISO 8601 Zeitstempel
    
    @SerializedName("updatedAt")
    private String updatedAt; // ISO 8601 Zeitstempel

    public ActionRunnable getActionRunnable(Map<String, Device> devices, Map<String, Scene> scenes, Map<String, ActionRunnable> actionRunnables) {
        return new ActionRunnable(() -> {
            // Führe Action asynchron in eigenem Thread aus
            actionExecutor.submit(() -> {
                executeWorkflow(devices, scenes, actionRunnables, null);
            });
        }) {
            @Override
            public void run(Object value) {
                // Führe Action asynchron in eigenem Thread aus
                actionExecutor.submit(() -> {
                    executeWorkflow(devices, scenes, actionRunnables, value);
                });
            }
        };
    }

    private void executeWorkflow(Map<String, Device> devices, Map<String, Scene> scenes, 
                                  Map<String, ActionRunnable> actionRunnables, Object triggerValue) {
        // Prüfe, ob die Action bereits ausgeführt wird
        synchronized (this) {
            if (isExecuting) {
                logger.warn("⚠️  Action {} wird bereits ausgeführt - Trigger ignoriert (actionId={}, name={})", actionId, actionId, name);
                return;
            }
            // Setze Flag, dass die Action jetzt ausgeführt wird
            isExecuting = true;
        }
        
        try {
            logger.info("🚀 ACTION START: actionId={}, name={}, triggerValue={}", actionId, name, triggerValue);
            
            if (workflow == null || workflow.getNodes() == null || workflow.getNodes().isEmpty()) {
                logger.warn("Workflow für Action {} ist leer", actionId);
                return;
            }

        logger.info("📋 Workflow-Details: {} Knoten vorhanden", workflow.getNodes().size());

        // Finde Startknoten
        String startNodeId = workflow.getStartNodeId();
        Node startNode = null;
        
        if (startNodeId != null && !startNodeId.isEmpty()) {
            startNode = findNodeById(workflow.getNodes(), startNodeId);
            logger.info("📍 Startknoten-ID: {}", startNodeId);
        }
        
        // Falls kein startNodeId gesetzt ist, suche nach dem ersten Trigger-Node
        if (startNode == null) {
            startNode = workflow.getTriggerNode();
            if (startNode != null) {
                logger.info("📍 Trigger-Node als Startknoten verwendet: {}", startNode.getNodeId());
            }
        }
        
        // Falls immer noch kein Startknoten gefunden, nimm den ersten Node
        if (startNode == null && !workflow.getNodes().isEmpty()) {
            startNode = workflow.getNodes().get(0);
            logger.info("📍 Erster Node als Startknoten verwendet: {}", startNode.getNodeId());
        }

        if (startNode == null) {
            logger.warn("Kein Startknoten für Action {} gefunden", actionId);
            return;
        }

            // Führe Workflow aus
            executeNode(startNode, devices, scenes, actionRunnables, triggerValue, new HashMap<>());
            
            logger.info("✅ ACTION ENDE: actionId={}, name={}", actionId, name);
        } finally {
            // Setze Flag zurück, dass die Action nicht mehr ausgeführt wird
            synchronized (this) {
                isExecuting = false;
            }
            logger.debug("🔓 Action {} ist wieder verfügbar für neue Trigger", actionId);
        }
    }

    private Node findNodeById(List<Node> nodes, String nodeId) {
        if (nodes == null || nodeId == null) {
            return null;
        }
        return nodes.stream()
                .filter(node -> nodeId.equals(node.getNodeId()))
                .findFirst()
                .orElse(null);
    }

    private void executeNode(Node node, Map<String, Device> devices, Map<String, Scene> scenes,
                            Map<String, ActionRunnable> actionRunnables, Object triggerValue,
                            Map<String, Object> context) {
        if (node == null) {
            return;
        }

        String nodeType = node.getType();
        if (nodeType == null) {
            logger.warn("Node {} hat keinen Typ", node.getNodeId());
            return;
        }

        logger.info("  🔹 Node ausgeführt: nodeId={}, type={}, actionId={}", node.getNodeId(), nodeType, actionId);

        try {
            switch (nodeType) {
                case "trigger":
                    // Trigger-Node wird übersprungen, fahre mit nächsten Nodes fort
                    logger.info("  ⏭️  Trigger-Node übersprungen, fahre mit nächsten Nodes fort");
                    executeNextNodes(node, devices, scenes, actionRunnables, triggerValue, context);
                    break;
                    
                case "action":
                    executeActionNode(node, devices, scenes, actionRunnables, context);
                    break;
                    
                case "condition":
                    logger.info("  ❓ Condition-Node wird ausgewertet");
                    executeConditionNode(node, devices, scenes, actionRunnables, context);
                    break;
                    
                case "wait":
                    logger.info("  ⏳ Wait-Node wird ausgeführt");
                    executeWaitNode(node, devices, scenes, actionRunnables, context);
                    break;
                    
                case "loop":
                    logger.info("  🔄 Loop-Node wird ausgeführt");
                    executeLoopNode(node, devices, scenes, actionRunnables, context);
                    break;
                    
                default:
                    logger.warn("Unbekannter Node-Typ: {} für Node {}", nodeType, node.getNodeId());
                    executeNextNodes(node, devices, scenes, actionRunnables, triggerValue, context);
            }
        } catch (Exception e) {
            logger.error("Fehler beim Ausführen von Node {} (Typ: {})", node.getNodeId(), nodeType, e);
        }
    }

    private void executeActionNode(Node node, Map<String, Device> devices, Map<String, Scene> scenes,
                                  Map<String, ActionRunnable> actionRunnables, Map<String, Object> context) {
        ActionConfig actionConfig = node.getActionConfig();
        if (actionConfig == null) {
            logger.warn("Action-Node {} hat keine ActionConfig", node.getNodeId());
            executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            return;
        }

        String actionType = actionConfig.getType();
        String actionName = actionConfig.getAction();
        List<Object> values = actionConfig.getValues();

        logger.info("  ⚙️  Action-Node: type={}, action={}, values={}", actionType, actionName, values);

        try {
            if ("device".equals(actionType)) {
                String deviceId = actionConfig.getDeviceId();
                if (deviceId == null) {
                    logger.warn("Device-Action in Node {} hat keine deviceId", node.getNodeId());
                    executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                    return;
                }

                Device device = devices.get(deviceId);
                if (device == null) {
                    logger.warn("Device {} nicht gefunden für Action-Node {}", deviceId, node.getNodeId());
                    executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                    return;
                }

                logger.info("  📱 Device-Action: deviceId={}, deviceName={}, method={}, params={}", 
                    deviceId, device.getName(), actionName, values);

                // Rufe Device-Methode über Reflection auf
                invokeDeviceMethod(device, actionName, values);
                
            } else if ("action".equals(actionType)) {
                // Führe eine andere Action aus
                logger.info("  🔗 Sub-Action ausgeführt: actionId={}", actionName);
                if (actionName != null && actionRunnables.containsKey(actionName)) {
                    actionRunnables.get(actionName).run();
                } else {
                    logger.warn("Action {} nicht gefunden für Action-Node {}", actionName, node.getNodeId());
                }
            } else {
                logger.warn("Unbekannter Action-Typ: {} für Node {}", actionType, node.getNodeId());
            }
        } catch (Exception e) {
            logger.error("Fehler beim Ausführen der Action in Node {}", node.getNodeId(), e);
        }

        executeNextNodes(node, devices, scenes, actionRunnables, null, context);
    }

    private void invokeDeviceMethod(Device device, String methodName, List<Object> values) {
        try {
            // Parse Methodenname (kann Parameter enthalten, z.B. "setVolume(int)")
            String baseMethodName = methodName;
            if (methodName.contains("(")) {
                baseMethodName = methodName.substring(0, methodName.indexOf("("));
            }

            logger.info("    🔧 Rufe Device-Methode auf: device={}, method={}, params={}", 
                device.getName() != null ? device.getName() : device.getId(), baseMethodName, values);

            // Finde Methode über Reflection
            Method method = null;
            Class<?> deviceClass = device.getClass();
            
            if (values == null || values.isEmpty()) {
                // Methode ohne Parameter - versuche zuerst mit execute Parameter
                try {
                    method = deviceClass.getMethod(baseMethodName, boolean.class);
                    logger.info("    ✅ Methode gefunden: {}(boolean execute), rufe auf mit execute=true...", baseMethodName);
                    method.invoke(device, true);
                    logger.info("    ✅ Methode erfolgreich ausgeführt: {}(execute=true)", baseMethodName);
                } catch (NoSuchMethodException e) {
                    // Versuche ohne execute Parameter (Fallback)
                    try {
                        method = deviceClass.getMethod(baseMethodName);
                        logger.info("    ✅ Methode gefunden: {}(), rufe auf...", baseMethodName);
                        method.invoke(device);
                        logger.info("    ✅ Methode erfolgreich ausgeführt: {}()", baseMethodName);
                    } catch (NoSuchMethodException e2) {
                        logger.warn("Methode {} ohne Parameter nicht gefunden für Device {}", baseMethodName, device.getId());
                    }
                }
            } else if (values.size() == 1) {
                // Methode mit einem Parameter - füge execute Parameter hinzu
                Object param = values.get(0);
                Class<?> paramType = param.getClass();
                
                // Versuche verschiedene Parametertypen mit execute Parameter
                Class<?>[] paramTypes = {
                    paramType,
                    int.class, Integer.class,
                    double.class, Double.class,
                    boolean.class, Boolean.class,
                    String.class
                };
                
                for (Class<?> type : paramTypes) {
                    try {
                        method = deviceClass.getMethod(baseMethodName, type, boolean.class);
                        Object convertedParam = convertValue(param, type);
                        logger.info("    ✅ Methode gefunden: {}({}, boolean execute), rufe auf mit param={}, execute=true...", 
                            baseMethodName, type.getSimpleName(), convertedParam);
                        method.invoke(device, convertedParam, true);
                        logger.info("    ✅ Methode erfolgreich ausgeführt: {}({}, execute=true)", baseMethodName, convertedParam);
                        return;
                    } catch (NoSuchMethodException e) {
                        // Weiter versuchen
                    }
                }
                
                logger.warn("Methode {} mit Parameter {} und execute nicht gefunden für Device {}", 
                    baseMethodName, paramType.getSimpleName(), device.getId());
            } else if (values.size() == 2) {
                // Methode mit zwei Parametern - füge execute Parameter hinzu
                Object param1 = values.get(0);
                Object param2 = values.get(1);
                Class<?> param1Type = param1.getClass();
                Class<?> param2Type = param2.getClass();
                
                // Versuche verschiedene Parametertypen-Kombinationen mit execute Parameter
                Class<?>[] param1Types = {
                    param1Type,
                    int.class, Integer.class,
                    double.class, Double.class,
                    boolean.class, Boolean.class,
                    String.class
                };
                Class<?>[] param2Types = {
                    param2Type,
                    int.class, Integer.class,
                    double.class, Double.class,
                    boolean.class, Boolean.class,
                    String.class
                };
                
                for (Class<?> type1 : param1Types) {
                    for (Class<?> type2 : param2Types) {
                        try {
                            method = deviceClass.getMethod(baseMethodName, type1, type2, boolean.class);
                            Object convertedParam1 = convertValue(param1, type1);
                            Object convertedParam2 = convertValue(param2, type2);
                            logger.info("    ✅ Methode gefunden: {}({}, {}, boolean execute), rufe auf mit param1={}, param2={}, execute=true...", 
                                baseMethodName, type1.getSimpleName(), type2.getSimpleName(), convertedParam1, convertedParam2);
                            method.invoke(device, convertedParam1, convertedParam2, true);
                            logger.info("    ✅ Methode erfolgreich ausgeführt: {}({}, {}, execute=true)", 
                                baseMethodName, convertedParam1, convertedParam2);
                            return;
                        } catch (NoSuchMethodException e) {
                            // Weiter versuchen
                        }
                    }
                }
                
                logger.warn("Methode {} mit Parametern {} und {} und execute nicht gefunden für Device {}", 
                    baseMethodName, param1Type.getSimpleName(), param2Type.getSimpleName(), device.getId());
            } else {
                logger.warn("Methoden mit mehr als 2 Parametern werden noch nicht unterstützt für Device {}", device.getId());
            }
        } catch (Exception e) {
            logger.error("Fehler beim Aufrufen der Methode {} auf Device {}", methodName, device.getId(), e);
        }
    }

    private Object convertValue(Object value, Class<?> targetType) {
        if (value == null) {
            return null;
        }
        
        if (targetType.isAssignableFrom(value.getClass())) {
            return value;
        }
        
        // Typkonvertierungen
        if (targetType == int.class || targetType == Integer.class) {
            if (value instanceof Number) {
                return ((Number) value).intValue();
            }
            if (value instanceof String) {
                return Integer.parseInt((String) value);
            }
        }
        
        if (targetType == double.class || targetType == Double.class) {
            if (value instanceof Number) {
                return ((Number) value).doubleValue();
            }
            if (value instanceof String) {
                return Double.parseDouble((String) value);
            }
        }
        
        if (targetType == boolean.class || targetType == Boolean.class) {
            if (value instanceof Boolean) {
                return value;
            }
            if (value instanceof String) {
                return Boolean.parseBoolean((String) value);
            }
        }
        
        if (targetType == String.class) {
            return value.toString();
        }
        
        return value;
    }

    private void executeConditionNode(Node node, Map<String, Device> devices, Map<String, Scene> scenes,
                                     Map<String, ActionRunnable> actionRunnables, Map<String, Object> context) {
        ConditionConfig conditionConfig = node.getConditionConfig();
        if (conditionConfig == null) {
            logger.warn("Condition-Node {} hat keine ConditionConfig", node.getNodeId());
            executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            return;
        }

        boolean conditionResult = evaluateCondition(conditionConfig, devices);
        
        List<String> nextNodes = conditionResult ? node.getTrueNodes() : node.getFalseNodes();
        if (nextNodes != null && !nextNodes.isEmpty()) {
            for (String nextNodeId : nextNodes) {
                Node nextNode = findNodeById(workflow.getNodes(), nextNodeId);
                if (nextNode != null) {
                    executeNode(nextNode, devices, scenes, actionRunnables, null, context);
                }
            }
        }
    }

    private boolean evaluateCondition(ConditionConfig conditionConfig, Map<String, Device> devices) {
        String deviceId = conditionConfig.getDeviceId();
        String property = conditionConfig.getProperty();
        List<Object> values = conditionConfig.getValues();

        if (deviceId == null || property == null) {
            return false;
        }

        Device device = devices.get(deviceId);
        if (device == null) {
            logger.warn("Device {} nicht gefunden für Condition", deviceId);
            return false;
        }

        try {
            // Parse Property (z.B. "isConnected()", "brighterAs(int)")
            String basePropertyName = property;
            if (property.contains("(")) {
                basePropertyName = property.substring(0, property.indexOf("("));
            }

            // Rufe Property-Methode über Reflection auf
            Method method = null;
            Class<?> deviceClass = device.getClass();
            
            if (values == null || values.isEmpty()) {
                // Methode ohne Parameter
                method = deviceClass.getMethod(basePropertyName);
                Object result = method.invoke(device);
                if (result instanceof Boolean) {
                    return (Boolean) result;
                }
            } else if (values.size() == 1) {
                // Methode mit einem Parameter
                Object param = values.get(0);
                Class<?> paramType = param.getClass();
                
                // Versuche verschiedene Parametertypen
                Class<?>[] paramTypes = {
                    paramType,
                    int.class, Integer.class,
                    double.class, Double.class,
                    boolean.class, Boolean.class,
                    String.class
                };
                
                for (Class<?> type : paramTypes) {
                    try {
                        method = deviceClass.getMethod(basePropertyName, type);
                        Object convertedParam = convertValue(param, type);
                        Object result = method.invoke(device, convertedParam);
                        if (result instanceof Boolean) {
                            return (Boolean) result;
                        }
                        break;
                    } catch (NoSuchMethodException e) {
                        // Weiter versuchen
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Fehler beim Auswerten der Condition für Device {}", deviceId, e);
        }

        return false;
    }

    private void executeWaitNode(Node node, Map<String, Device> devices, Map<String, Scene> scenes,
                                Map<String, ActionRunnable> actionRunnables, Map<String, Object> context) {
        WaitConfig waitConfig = node.getWaitConfig();
        if (waitConfig == null) {
            logger.warn("Wait-Node {} hat keine WaitConfig", node.getNodeId());
            executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            return;
        }

        String waitType = waitConfig.getType();
        if ("time".equals(waitType)) {
            Integer waitTime = waitConfig.getWaitTime();
            if (waitTime != null && waitTime > 0) {
                // Warte synchron bis die gesamte Ausführung abgeschlossen ist
                try {
                    logger.info("  ⏳ Warte {} Sekunden synchron...", waitTime);
                    Thread.sleep(waitTime * 1000L);
                    logger.info("  ✅ Wartezeit abgeschlossen, fahre mit nextNodes fort");
                } catch (InterruptedException e) {
                    logger.error("Wartezeit wurde unterbrochen für Wait-Node {}", node.getNodeId(), e);
                    Thread.currentThread().interrupt();
                }
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                return;
            }
        } else if ("trigger".equals(waitType)) {
            String deviceId = waitConfig.getDeviceId();
            String triggerEvent = waitConfig.getTriggerEvent();
            
            if (deviceId == null || triggerEvent == null || deviceId.isEmpty() || triggerEvent.isEmpty()) {
                logger.warn("Wait-Node {} vom Typ 'trigger' hat keine deviceId oder triggerEvent", node.getNodeId());
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                return;
            }
            
            Device device = devices.get(deviceId);
            if (device == null) {
                logger.warn("Device {} nicht gefunden für Wait-Node {} vom Typ 'trigger'", deviceId, node.getNodeId());
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                return;
            }
            
            logger.info("  ⏳ Wait-Node auf Trigger: deviceId={}, triggerEvent={}", deviceId, triggerEvent);
            
            // Erstelle einen eindeutigen Key für diesen Listener (basierend auf Node-ID und Action-ID)
            String listenerKey = actionId + "-wait-" + node.getNodeId();
            
            // CountDownLatch um auf den Abschluss des Listeners zu warten
            CountDownLatch latch = new CountDownLatch(1);
            
            // AtomicBoolean um sicherzustellen, dass der Listener nur einmal ausgeführt wird
            java.util.concurrent.atomic.AtomicBoolean executed = new java.util.concurrent.atomic.AtomicBoolean(false);
            
            // Erstelle den Listener, der nextNodes ausführt und sich selbst entfernt
            Runnable waitListener = () -> {
                // Prüfe, ob bereits ausgeführt wurde
                if (executed.getAndSet(true)) {
                    logger.debug("  ⏳ Wait-Listener wurde bereits ausgeführt - überspringe");
                    latch.countDown(); // Latch auch bei Überspringen counten
                    return;
                }
                
                logger.info("  ✅ Trigger-Event ausgelöst: deviceId={}, triggerEvent={} - führe nextNodes aus", deviceId, triggerEvent);
                
                try {
                    // Führe nextNodes aus
                    executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                    logger.info("  ✅ executeNextNodes im Wait-Listener abgeschlossen");
                } finally {
                    // Entferne den Listener direkt nach der Ausführung
                    logger.info("  🗑️  Entferne Wait-Listener: key={}, triggerEvent={}", listenerKey, triggerEvent);
                    device.removeListener(listenerKey, triggerEvent);
                    
                    // Signalisiere, dass die Ausführung abgeschlossen ist
                    latch.countDown();
                }
            };
            
            // Erstelle DeviceListenerParams basierend auf triggerValues
            com.smarthome.backend.model.devices.helper.DeviceListenerParams params;
            List<Object> triggerValues = waitConfig.getTriggerValues();
            
            if (triggerValues == null || triggerValues.isEmpty()) {
                params = new com.smarthome.backend.model.devices.helper.DeviceListenerParams(listenerKey, triggerEvent);
            } else if (triggerValues.size() == 1) {
                params = new com.smarthome.backend.model.devices.helper.DeviceListenerParams(listenerKey, triggerEvent, triggerValues.get(0));
            } else if (triggerValues.size() == 2) {
                params = new com.smarthome.backend.model.devices.helper.DeviceListenerParams(listenerKey, triggerEvent, triggerValues.get(0), triggerValues.get(1));
            } else {
                logger.warn("Wait-Node {} hat mehr als 2 triggerValues - verwende nur die ersten beiden", node.getNodeId());
                params = new com.smarthome.backend.model.devices.helper.DeviceListenerParams(listenerKey, triggerEvent, triggerValues.get(0), triggerValues.get(1));
            }
            
            // Füge Listener zum Device hinzu
            logger.info("  📌 Registriere Wait-Listener: key={}, triggerEvent={}", listenerKey, triggerEvent);
            device.addListener(params, waitListener);
            
            // Prüfe sofort, ob die Bedingung bereits erfüllt ist
            device.triggerCheckListener(triggerEvent);
            
            // Warte synchron auf den Abschluss des waitListeners
            try {
                // Hole Timeout aus WaitConfig
                Integer timeoutSeconds = waitConfig.getTimeout();
                if (timeoutSeconds == null || timeoutSeconds == 0) {
                    // Wenn Timeout = 0 oder null, mindestens 1 Tag warten
                    timeoutSeconds = 86400; // 1 Tag in Sekunden
                    logger.info("  ⏳ Warte auf Abschluss des Wait-Listeners (Timeout: 1 Tag, da timeout=0 oder null)...");
                } else {
                    logger.info("  ⏳ Warte auf Abschluss des Wait-Listeners (Timeout: {}s)...", timeoutSeconds);
                }
                
                boolean completed = latch.await(timeoutSeconds, TimeUnit.SECONDS);
                if (completed) {
                    logger.info("  ✅ Wait-Listener vollständig abgeschlossen");
                } else {
                    logger.warn("  ⚠️  Timeout beim Warten auf Wait-Listener - entferne Listener");
                    device.removeListener(listenerKey, triggerEvent);
                }
            } catch (InterruptedException e) {
                logger.error("Warten auf Wait-Listener wurde unterbrochen für Wait-Node {}", node.getNodeId(), e);
                Thread.currentThread().interrupt();
                // Entferne Listener bei Unterbrechung
                device.removeListener(listenerKey, triggerEvent);
            }
            return;
        }

        executeNextNodes(node, devices, scenes, actionRunnables, null, context);
    }

    private void executeLoopNode(Node node, Map<String, Device> devices, Map<String, Scene> scenes,
                                Map<String, ActionRunnable> actionRunnables, Map<String, Object> context) {
        LoopConfig loopConfig = node.getLoopConfig();
        if (loopConfig == null) {
            logger.warn("Loop-Node {} hat keine LoopConfig", node.getNodeId());
            executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            return;
        }

        String loopType = loopConfig.getType();
        List<String> loopNodes = node.getLoopNodes();
        
        if (loopNodes == null || loopNodes.isEmpty()) {
            logger.warn("Loop-Node {} hat keine loopNodes", node.getNodeId());
            executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            return;
        }

        logger.info("  🔄 Loop-Node: type={}, loopNodes={}", loopType, loopNodes);

        if ("for".equals(loopType)) {
            Integer count = loopConfig.getCount();
            if (count == null || count <= 0) {
                logger.warn("Loop-Node {} vom Typ 'for' hat keinen gültigen count-Wert", node.getNodeId());
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                return;
            }

            logger.info("  🔄 For-Loop: {} Wiederholungen", count);
            
            // Führe die Loop-Nodes count-Mal aus
            for (int i = 0; i < count; i++) {
                logger.info("  🔄 Loop-Iteration {}/{}", i + 1, count);
                
                // Führe alle Loop-Nodes nacheinander aus
                for (String loopNodeId : loopNodes) {
                    Node loopNode = findNodeById(workflow.getNodes(), loopNodeId);
                    if (loopNode != null) {
                        executeNode(loopNode, devices, scenes, actionRunnables, null, context);
                    } else {
                        logger.warn("Loop-Node {} nicht gefunden für Loop-Node {}", loopNodeId, node.getNodeId());
                    }
                }
            }
            
            logger.info("  ✅ For-Loop abgeschlossen: {} Iterationen ausgeführt", count);
            
            // Fahre mit nextNodes fort, falls vorhanden
            if (node.getNextNodes() != null && !node.getNextNodes().isEmpty()) {
                logger.info("  ➡️  Fahre mit nextNodes fort nach Loop");
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            }
            
        } else if ("while".equals(loopType)) {
            ConditionConfig condition = loopConfig.getCondition();
            if (condition == null) {
                logger.warn("While-Loop-Node {} hat keine Condition in LoopConfig", node.getNodeId());
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
                return;
            }

            logger.info("  🔄 While-Loop: Condition wird vor jeder Iteration geprüft");
            
            int iteration = 0;
            // Führe die Loop-Nodes aus, solange die Condition true ist
            while (true) {
                iteration++;
                logger.info("  🔄 While-Loop-Iteration {}: Prüfe Condition...", iteration);
                
                // Prüfe Condition vor der Ausführung
                boolean conditionResult = evaluateCondition(condition, devices);
                logger.info("  ❓ Condition-Ergebnis: {}", conditionResult);
                
                if (!conditionResult) {
                    logger.info("  ⏹️  Condition ist false - While-Loop beendet nach {} Iterationen", iteration - 1);
                    break;
                }
                
                logger.info("  ✅ Condition ist true - führe Loop-Nodes aus (Iteration {})", iteration);
                
                // Führe alle Loop-Nodes nacheinander aus
                for (String loopNodeId : loopNodes) {
                    Node loopNode = findNodeById(workflow.getNodes(), loopNodeId);
                    if (loopNode != null) {
                        executeNode(loopNode, devices, scenes, actionRunnables, null, context);
                    } else {
                        logger.warn("Loop-Node {} nicht gefunden für Loop-Node {}", loopNodeId, node.getNodeId());
                    }
                }
            }
            
            logger.info("  ✅ While-Loop abgeschlossen: {} Iterationen ausgeführt", iteration - 1);
            
            // Fahre mit nextNodes fort, falls vorhanden
            if (node.getNextNodes() != null && !node.getNextNodes().isEmpty()) {
                logger.info("  ➡️  Fahre mit nextNodes fort nach While-Loop");
                executeNextNodes(node, devices, scenes, actionRunnables, null, context);
            }
            
        } else {
            logger.warn("Unbekannter Loop-Typ: {} für Loop-Node {}", loopType, node.getNodeId());
            executeNextNodes(node, devices, scenes, actionRunnables, null, context);
        }
    }

    private void executeNextNodes(Node node, Map<String, Device> devices, Map<String, Scene> scenes,
                                  Map<String, ActionRunnable> actionRunnables, Object triggerValue,
                                  Map<String, Object> context) {
        List<String> nextNodes = node.getNextNodes();
        if (nextNodes != null && !nextNodes.isEmpty()) {
            for (String nextNodeId : nextNodes) {
                Node nextNode = findNodeById(workflow.getNodes(), nextNodeId);
                if (nextNode != null) {
                    executeNode(nextNode, devices, scenes, actionRunnables, triggerValue, context);
                }
            }
        }
    }

    public String getTriggerType() {
        return triggerType;
    }
}
