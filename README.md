# Ngrok Server - Java Implementation

Ein Java-basierter ngrok Server für die Erstellung und Verwaltung von Tunnels.

## Projektstruktur

```
smarthome-backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── smarthome/
│   │   │           └── backend/
│   │   │               └── server/
│   │   │                   ├── NgrokServer.java      # Hauptklasse
│   │   │                   ├── TunnelManager.java   # Tunnel-Verwaltung
│   │   │                   ├── Tunnel.java          # Tunnel-Repräsentation
│   │   │                   └── ApiHandler.java      # API Handler
│   │   └── resources/
│   │       └── application.properties          # Konfigurationsdatei
│   └── test/
│       └── java/
│           └── com/
│               └── smarthome/
│                   └── backend/
│                       └── server/
│                           └── TunnelTest.java      # Unit Tests
├── pom.xml                                      # Maven Konfiguration
└── README.md                                    # Diese Datei
```

## Voraussetzungen

- Java 11 oder höher
- Maven 3.6 oder höher

## Build

```bash
mvn clean compile
```

## Ausführung

```bash
mvn exec:java -Dexec.mainClass="com.smarthome.backend.server.NgrokServer"
```

Oder nach dem Build:

```bash
java -jar target/ngrok-server-1.0.0.jar
```

## Konfiguration

Die Konfiguration erfolgt über `src/main/resources/application.properties`.

## Entwicklung

Das Projekt verwendet Maven als Build-Tool. Die Hauptklasse ist `NgrokServer`, die den Server startet und verwaltet.

## Dependencies

- Gson: JSON-Verarbeitung
- SLF4J: Logging
- JUnit: Testing

