package com.smarthome.backend.server.actions;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.smarthome.backend.model.TimeTrigger;

/**
 * Runnable-Implementierung für zeitbasierte Trigger.
 * 
 * Diese Klasse wartet kontinuierlich, bis ein Time-Trigger ausgeführt werden muss,
 * führt dann den zugehörigen Workflow aus und plant sich selbst für die nächste Ausführung.
 * 
 * Unterstützt die Frequenzen: daily, weekly, monthly, yearly
 */
public class TimeTriggerRunnable extends ActionRunnable {
    private static final Logger logger = LoggerFactory.getLogger(TimeTriggerRunnable.class);
    
    /**
     * Der TimeTrigger mit der Konfiguration.
     */
    private final TimeTrigger timeTrigger;
    
   
    /**
     * Der Scheduler-Service für die Planung.
     */
    private final ScheduledExecutorService schedulerService;
    
    /**
     * Flag, ob der Runnable gestoppt werden soll.
     */
    private final AtomicBoolean stopped = new AtomicBoolean(false);
    
    /**
     * Die aktuelle ScheduledFuture für die nächste Ausführung.
     */
    private volatile ScheduledFuture<?> scheduledFuture;
    
    /**
     * Konstruktor.
     * 
     * @param timeTrigger Der TimeTrigger mit der Konfiguration
     * @param workflowRunnable Die Runnable-Instanz, die den Workflow ausführt
     * @param schedulerService Der Scheduler-Service für die Planung
     */
    public TimeTriggerRunnable(TimeTrigger timeTrigger, Runnable workflowRunnable, 
                               ScheduledExecutorService schedulerService) {
        super(workflowRunnable);

        if (timeTrigger == null) {
            throw new IllegalArgumentException("TimeTrigger darf nicht null sein");
        }
        if (workflowRunnable == null) {
            throw new IllegalArgumentException("WorkflowRunnable darf nicht null sein");
        }
        if (schedulerService == null) {
            throw new IllegalArgumentException("SchedulerService darf nicht null sein");
        }
        
        this.timeTrigger = timeTrigger;
        this.schedulerService = schedulerService;
    }
    
    /**
     * Startet den Time-Trigger-Runnable.
     * Plant die erste Ausführung und beginnt den Warteprozess.
     */
    public void start() {
        if (stopped.get()) {
            logger.warn("TimeTriggerRunnable wurde bereits gestoppt, kann nicht gestartet werden");
            return;
        }
        
        logger.info("Starte TimeTriggerRunnable: frequency={}, time={}", 
            timeTrigger.getFrequency(), timeTrigger.getTime());
        
        // Plane die erste Ausführung
        scheduleNextExecution();
    }
    
    /**
     * Stoppt den Time-Trigger-Runnable.
     */
    public void stop() {
        if (stopped.compareAndSet(false, true)) {
            logger.info("Stoppe TimeTriggerRunnable");
            
            if (scheduledFuture != null) {
                scheduledFuture.cancel(false);
                scheduledFuture = null;
            }
        }
    }
    
    /**
     * Führt den Runnable aus.
     * Diese Methode wird vom Scheduler aufgerufen, wenn die Zeit gekommen ist.
     */
    @Override
    public void run() {
        if (stopped.get()) {
            logger.debug("TimeTriggerRunnable wurde gestoppt, führe keine Ausführung durch");
            return;
        }
        
        try {
            // Prüfe, ob der Trigger jetzt ausgeführt werden muss
            if (shouldExecuteNow()) {
                logger.info("Führe Time-Trigger aus: frequency={}, time={}", 
                    timeTrigger.getFrequency(), timeTrigger.getTime());
                
                // Führe den Workflow aus
                listener.run();
                
                logger.debug("Time-Trigger erfolgreich ausgeführt");
            } else {
                logger.debug("Time-Trigger sollte noch nicht ausgeführt werden, warte weiter");
            }
        } catch (Exception e) {
            logger.error("Fehler beim Ausführen des Time-Triggers", e);
        } finally {
            // Plane die nächste Ausführung
            if (!stopped.get()) {
                scheduleNextExecution();
            }
        }
    }
    
    /**
     * Prüft, ob der Trigger jetzt ausgeführt werden muss.
     * 
     * @return true wenn der Trigger jetzt ausgeführt werden soll, false sonst
     */
    private boolean shouldExecuteNow() {
        LocalDateTime now = LocalDateTime.now();
        LocalTime targetTime = parseTime(timeTrigger.getTime());
        if (targetTime == null) {
            return false;
        }
        
        String frequency = timeTrigger.getFrequency();
        
        switch (frequency) {
            case "daily":
                return shouldExecuteDaily(now, targetTime);
            case "weekly":
                return shouldExecuteWeekly(now, targetTime);
            case "monthly":
                return shouldExecuteMonthly(now, targetTime);
            case "yearly":
                return shouldExecuteYearly(now, targetTime);
            default:
                logger.warn("Unbekannte Frequency: {}", frequency);
                return false;
        }
    }
    
    /**
     * Prüft, ob ein täglicher Trigger jetzt ausgeführt werden soll.
     */
    private boolean shouldExecuteDaily(LocalDateTime now, LocalTime targetTime) {
        LocalTime nowTime = now.toLocalTime();
        // Prüfe, ob die aktuelle Zeit innerhalb von 1 Minute der Zielzeit liegt
        long minutesDiff = Math.abs(ChronoUnit.MINUTES.between(nowTime, targetTime));
        return minutesDiff <= 1;
    }
    
    /**
     * Prüft, ob ein wöchentlicher Trigger jetzt ausgeführt werden soll.
     */
    private boolean shouldExecuteWeekly(LocalDateTime now, LocalTime targetTime) {
        if (!shouldExecuteDaily(now, targetTime)) {
            return false;
        }
        
        List<Integer> weekdays = timeTrigger.getWeekdays();
        if (weekdays == null || weekdays.isEmpty()) {
            // Wenn keine Wochentage angegeben, täglich ausführen
            return true;
        }
        
        // Java DayOfWeek: 1=Monday, 7=Sunday
        // TimeTrigger weekdays: 0=Sunday, 6=Saturday
        int currentDayOfWeek = now.getDayOfWeek().getValue();
        int triggerDayOfWeek = (currentDayOfWeek == 7) ? 0 : currentDayOfWeek;
        
        return weekdays.contains(triggerDayOfWeek);
    }
    
    /**
     * Prüft, ob ein monatlicher Trigger jetzt ausgeführt werden soll.
     */
    private boolean shouldExecuteMonthly(LocalDateTime now, LocalTime targetTime) {
        if (!shouldExecuteDaily(now, targetTime)) {
            return false;
        }
        
        // Monatlich: am selben Tag des Monats ausführen
        // (z.B. jeden 15. des Monats)
        // Für die erste Implementierung: am ersten Tag des Monats
        return now.getDayOfMonth() == 1;
    }
    
    /**
     * Prüft, ob ein jährlicher Trigger jetzt ausgeführt werden soll.
     */
    private boolean shouldExecuteYearly(LocalDateTime now, LocalTime targetTime) {
        if (!shouldExecuteDaily(now, targetTime)) {
            return false;
        }
        
        // Jährlich: am selben Tag und Monat ausführen
        // Für die erste Implementierung: am 1. Januar
        return now.getMonthValue() == 1 && now.getDayOfMonth() == 1;
    }
    
    /**
     * Plant die nächste Ausführung des Triggers.
     */
    private void scheduleNextExecution() {
        if (stopped.get()) {
            return;
        }
        
        LocalDateTime nextExecution = calculateNextExecution();
        if (nextExecution == null) {
            logger.warn("Konnte nächste Ausführungszeit nicht berechnen");
            return;
        }
        
        LocalDateTime now = LocalDateTime.now();
        long delayMillis = ChronoUnit.MILLIS.between(now, nextExecution);
        
        if (delayMillis < 0) {
            // Die Zeit ist bereits vergangen, plane für morgen/übermorgen
            nextExecution = calculateNextExecutionAfter(now.plusDays(1));
            if (nextExecution != null) {
                delayMillis = ChronoUnit.MILLIS.between(now, nextExecution);
            } else {
                logger.warn("Konnte keine gültige nächste Ausführungszeit berechnen");
                return;
            }
        }
        
        logger.debug("Plane nächste Ausführung für {} (in {} ms)", nextExecution, delayMillis);
        
        // Plane die Ausführung
        scheduledFuture = schedulerService.schedule(() -> this.run(), delayMillis, TimeUnit.MILLISECONDS);
    }
    
    /**
     * Berechnet die nächste Ausführungszeit basierend auf der Frequency.
     * 
     * @return Die nächste Ausführungszeit oder null bei Fehlern
     */
    private LocalDateTime calculateNextExecution() {
        LocalDateTime now = LocalDateTime.now();
        LocalTime targetTime = parseTime(timeTrigger.getTime());
        if (targetTime == null) {
            return null;
        }
        
        String frequency = timeTrigger.getFrequency();
        
        switch (frequency) {
            case "daily":
                return calculateNextDaily(now, targetTime);
            case "weekly":
                return calculateNextWeekly(now, targetTime);
            case "monthly":
                return calculateNextMonthly(now, targetTime);
            case "yearly":
                return calculateNextYearly(now, targetTime);
            default:
                logger.warn("Unbekannte Frequency: {}", frequency);
                return null;
        }
    }
    
    /**
     * Berechnet die nächste tägliche Ausführungszeit.
     */
    private LocalDateTime calculateNextDaily(LocalDateTime now, LocalTime targetTime) {
        LocalDateTime next = now.with(targetTime);
        if (next.isBefore(now) || next.isEqual(now)) {
            next = next.plusDays(1);
        }
        return next;
    }
    
    /**
     * Berechnet die nächste wöchentliche Ausführungszeit.
     */
    private LocalDateTime calculateNextWeekly(LocalDateTime now, LocalTime targetTime) {
        List<Integer> weekdays = timeTrigger.getWeekdays();
        if (weekdays == null || weekdays.isEmpty()) {
            // Wenn keine Wochentage angegeben, täglich ausführen
            return calculateNextDaily(now, targetTime);
        }
        
        LocalDateTime next = calculateNextDaily(now, targetTime);
        
        // Finde den nächsten passenden Wochentag
        for (int i = 0; i < 7; i++) {
            int dayOfWeek = next.getDayOfWeek().getValue();
            int triggerDayOfWeek = (dayOfWeek == 7) ? 0 : dayOfWeek;
            
            if (weekdays.contains(triggerDayOfWeek)) {
                return next;
            }
            
            next = next.plusDays(1);
        }
        
        return next;
    }
    
    /**
     * Berechnet die nächste monatliche Ausführungszeit.
     */
    private LocalDateTime calculateNextMonthly(LocalDateTime now, LocalTime targetTime) {
        LocalDateTime next = now.with(targetTime).withDayOfMonth(1);
        if (next.isBefore(now) || next.isEqual(now)) {
            next = next.plusMonths(1);
        }
        return next;
    }
    
    /**
     * Berechnet die nächste jährliche Ausführungszeit.
     */
    private LocalDateTime calculateNextYearly(LocalDateTime now, LocalTime targetTime) {
        LocalDateTime next = now.with(targetTime).withMonth(1).withDayOfMonth(1);
        if (next.isBefore(now) || next.isEqual(now)) {
            next = next.plusYears(1);
        }
        return next;
    }
    
    /**
     * Berechnet die nächste Ausführungszeit nach einem bestimmten Datum.
     * 
     * @param after Das Datum, nach dem die nächste Ausführung sein soll
     * @return Die nächste Ausführungszeit oder null bei Fehlern
     */
    private LocalDateTime calculateNextExecutionAfter(LocalDateTime after) {
        LocalTime targetTime = parseTime(timeTrigger.getTime());
        if (targetTime == null) {
            return null;
        }
        
        String frequency = timeTrigger.getFrequency();
        
        switch (frequency) {
            case "daily":
                return calculateNextDaily(after, targetTime);
            case "weekly":
                return calculateNextWeekly(after, targetTime);
            case "monthly":
                return calculateNextMonthly(after, targetTime);
            case "yearly":
                return calculateNextYearly(after, targetTime);
            default:
                return null;
        }
    }
    
    /**
     * Parst eine Zeit-String im Format HH:mm zu LocalTime.
     * 
     * @param timeString Die Zeit als String (Format: HH:mm)
     * @return Die LocalTime oder null bei Fehlern
     */
    private LocalTime parseTime(String timeString) {
        if (timeString == null || timeString.isEmpty()) {
            logger.warn("Zeit-String ist null oder leer");
            return null;
        }
        
        try {
            return LocalTime.parse(timeString);
        } catch (Exception e) {
            logger.error("Fehler beim Parsen der Zeit '{}': {}", timeString, e.getMessage());
            return null;
        }
    }
    
    /**
     * Gibt zurück, ob der Runnable gestoppt wurde.
     * 
     * @return true wenn gestoppt, false sonst
     */
    public boolean isStopped() {
        return stopped.get();
    }
}

