package com.smarthome.backend.server.actions;

import java.util.function.Consumer;

/**
 * Runnable-Implementierung für die Ausführung von Actions.
 * 
 * Diese Klasse kapselt eine Action und ermöglicht deren Ausführung
 * als Runnable, z.B. für Threads, ExecutorServices oder Scheduler.
 */
public abstract class ActionRunnable {

    protected final Runnable listener;
    protected final Consumer<Object> listenerWithParam;

    public ActionRunnable(Runnable listener) {
        this.listener = listener;
        this.listenerWithParam = null;
    }

    public ActionRunnable(Consumer<Object> listenerWithParam) {
        this.listener = null;
        this.listenerWithParam = listenerWithParam;
    }

    public void run() {
        if (listener != null) {
            listener.run();
        } else if (listenerWithParam != null) {
            listenerWithParam.accept(null);
        }
    }

    public void run(Object value) {
        if (listenerWithParam != null) {
            listenerWithParam.accept(value);
        } else if (listener != null) {
            listener.run();
        }
    }

}

