export declare const GlobalDurationTimer: {
    timedSync: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    timedAsync: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
    stop: () => void;
    isTimePassed: (threshold?: undefined | number) => boolean;
    start: () => void;
    reset: () => void;
};
