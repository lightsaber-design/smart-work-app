import { useCallback, useRef } from "react";

/**
 * Pulsación larga reutilizable. `bind(cb)` devuelve los handlers de puntero para
 * un elemento; `cb` se ejecuta tras mantener pulsado `delay` ms sin levantar ni
 * mover el dedo. `consumedLongPress()` permite ignorar el click que el navegador
 * dispara justo después de una pulsación larga (para no ejecutar también el tap).
 */
export function useLongPress(delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const bind = useCallback(
    (onLongPress: () => void) => ({
      onPointerDown: () => {
        longFired.current = false;
        cancel();
        timer.current = setTimeout(() => {
          timer.current = null;
          longFired.current = true;
          navigator.vibrate?.(40);
          onLongPress();
        }, delay);
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerMove: cancel,
      onPointerCancel: cancel,
    }),
    [cancel, delay],
  );

  const consumedLongPress = useCallback(() => {
    if (longFired.current) {
      longFired.current = false;
      return true;
    }
    return false;
  }, []);

  return { bind, consumedLongPress };
}
