import { useState, useEffect } from 'react';

export function usePersistedState<T>(
  key: string,
  initialValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (item: string) => T;
  }
): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);

  // Initialize from local storage on mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        if (options?.deserialize) {
          setState(options.deserialize(item));
        } else {
          try {
            setState(JSON.parse(item));
          } catch (e) {
            // String fallback if it's not JSON
            setState(item as any);
          }
        }
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);
      if (typeof window !== 'undefined') {
        if (options?.serialize) {
          window.localStorage.setItem(key, options.serialize(valueToStore));
        } else {
          window.localStorage.setItem(key, typeof valueToStore === 'string' ? valueToStore : JSON.stringify(valueToStore));
        }
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [state, setValue];
}
