use block2::RcBlock;
use objc2::rc::Retained;
use objc2::runtime::AnyObject;
use objc2_app_kit::{NSEvent, NSEventMask, NSEventPhase};
use std::cell::RefCell;
use std::ptr::NonNull;
use tauri::{AppHandle, Emitter};

thread_local! {
    static MONITOR: RefCell<Option<Retained<AnyObject>>> = const { RefCell::new(None) };
}

/// AppKit exposes the physical finger phase that Web WheelEvent omits.
/// The monitor passes every original event on to WebKit unchanged.
pub fn install(app: &AppHandle) {
    let handle = app.clone();
    let block = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
        // SAFETY: AppKit passes a live event pointer for the duration of this callback.
        let event_ref = unsafe { event.as_ref() };
        let phase = event_ref.phase();
        let momentum = event_ref.momentumPhase();
        let name = if phase.contains(NSEventPhase::Began) {
            Some("began")
        } else if phase.contains(NSEventPhase::Ended) {
            Some("ended")
        } else if phase.contains(NSEventPhase::Cancelled) {
            Some("cancelled")
        } else if momentum != NSEventPhase::None {
            Some("momentum")
        } else {
            Some("mouse")
        };
        if let Some(name) = name {
            let _ = handle.emit("diary-scroll-phase", name);
        }
        event.as_ptr()
    });
    // SAFETY: The callback returns the same valid NSEvent, and the monitor is retained
    // for the application thread's lifetime.
    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::ScrollWheel, &block)
    };
    MONITOR.with(|slot| *slot.borrow_mut() = monitor);
}
