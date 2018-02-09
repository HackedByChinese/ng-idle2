import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/throttleTime';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/merge';

import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { InterruptArgs } from './interruptargs';
import { InterruptSource } from './interruptsource';

/**
 * Options for EventTargetInterruptSource
 */
export interface EventTargetInterruptOptions {
  /**
   * The number of milliseconds to throttle the events coming from the target.
   */
  throttleDelay?: number;

  /**
   * Whether or not to use passive event listeners.
   * Note: you need to detect if the browser supports passive listeners, and only set this to true if it does.
   */
  passive?: boolean;
}

const defaultThrottleDelay = 500;

/*
 * An interrupt source on an EventTarget object, such as a Window or HTMLElement.
 */
export class EventTargetInterruptSource extends InterruptSource {
  private eventSrc: Observable<any>;
  private eventSubscription: Subscription = new Subscription();
  protected throttleDelay: number;
  protected passive: boolean;

  constructor(protected target: any, protected events: string, options?: number | EventTargetInterruptOptions) {
    super(null, null);

    if (typeof options === 'number') {
      options = { throttleDelay: options, passive: false };
    }

    options = options || { throttleDelay: defaultThrottleDelay, passive: false };

    if (options.throttleDelay === undefined || options.throttleDelay === null) {
      options.throttleDelay = defaultThrottleDelay;
    }

    this.throttleDelay = options.throttleDelay;
    this.passive = !!options.passive;

    const opts = this.passive ? { passive: true } : null;
    const fromEvents = events.split(' ').map(eventName => Observable.fromEvent<any>(target, eventName, opts));
    this.eventSrc = Observable.merge(...fromEvents);
    this.eventSrc = this.eventSrc.filter(innerArgs => !this.filterEvent(innerArgs));
    if (this.throttleDelay > 0) {
      this.eventSrc = this.eventSrc.throttleTime(this.throttleDelay);
    }

    let handler = (innerArgs: any) => this.onInterrupt.emit(new InterruptArgs(this, innerArgs));

    this.attachFn = () => this.eventSubscription = this.eventSrc.subscribe(handler);

    // If the current zone is the 'angular' zone (a.k.a. NgZone) then bind the attachFn to its parent
    // The parent zone is usually the '<root>' zone but it can also be 'long-stack-trace-zone' in debug mode
    // In tests, the current zone is typically a 'ProxyZone' created by async/fakeAsync (from @angular/core/testing)
    if (Zone.current.get('isAngularZone') === true) {
      this.attachFn = Zone.current.parent.wrap(this.attachFn, Zone.current.name);
    }

    this.detachFn = () => this.eventSubscription.unsubscribe();
  }

  /*
   * Checks to see if the event should be filtered. Always returns false unless overriden.
   * @param event - The original event object.
   * @return True if the event should be filtered (don't cause an interrupt); otherwise, false.
   */
  protected filterEvent(event: any): boolean {
    return false;
  }

  /**
   * Returns the current options being used.
   * @return {EventTargetInterruptOptions} The current option values.
   */
  get options(): EventTargetInterruptOptions {
    return { throttleDelay: this.throttleDelay, passive: this.passive };
  }
}
