"""
Central Event Manager for the Voxel MMO
Provides publish/subscribe pattern for cross-module communication
"""

from typing import Dict, List, Callable, Any, Optional
import logging
import time

logger = logging.getLogger(__name__)

class EventManager:
    """
    Central event manager using publish/subscribe pattern.
    One instance should be created at server startup and passed to modules that need it.
    """
    
    def __init__(self, debug_mode: bool = False):
        self._listeners: Dict[str, List[Callable]] = {}
        self._debug_mode = debug_mode
        self._event_history: List[Dict] = []  # For debugging
        self._max_history = 100
        
    def subscribe(self, event_type: str, callback: Callable[[Any, Optional[str]], None]) -> None:
        """Subscribe to an event type"""
        if event_type not in self._listeners:
            self._listeners[event_type] = []
        self._listeners[event_type].append(callback)
        
        if self._debug_mode:
            logger.debug(f"Subscribed to {event_type}: {callback.__name__}")
    
    def unsubscribe(self, event_type: str, callback: Callable) -> bool:
        """Unsubscribe from an event type"""
        if event_type in self._listeners:
            try:
                self._listeners[event_type].remove(callback)
                if self._debug_mode:
                    logger.debug(f"Unsubscribed from {event_type}: {callback.__name__}")
                return True
            except ValueError:
                pass
        return False
    
    def publish(self, event_type: str, data: Any = None, entity_id: Optional[str] = None) -> bool:
        """
        Publish an event to all subscribers
        Returns True if all handlers succeeded, False if any failed
        """
        if self._debug_mode:
            logger.info(f"[EVENT] {event_type} - Entity: {entity_id} - Data: {data}")
        
        # Track event for debugging
        self._event_history.append({
            'type': event_type,
            'data': data,
            'entity_id': entity_id,
            'timestamp': time.time()
        })
        
        # Trim history
        if len(self._event_history) > self._max_history:
            self._event_history.pop(0)
        
        success = True
        if event_type in self._listeners:
            for callback in self._listeners[event_type]:
                try:
                    callback(data, entity_id)
                except Exception as e:
                    logger.error(f"[ERROR] Event {event_type} handler {callback.__name__} failed: {e}")
                    success = False
        
        return success
    
    def get_event_history(self, event_type: Optional[str] = None) -> List[Dict]:
        """Get event history for debugging"""
        if event_type:
            return [e for e in self._event_history if e['type'] == event_type]
        return self._event_history.copy()
    
    def clear_history(self) -> None:
        """Clear event history"""
        self._event_history.clear()
    
    def get_listeners_count(self) -> Dict[str, int]:
        """Get count of listeners for each event type (for debugging)"""
        return {event: len(listeners) for event, listeners in self._listeners.items()}


# Global instance - created once at server startup
_global_event_manager: Optional[EventManager] = None

def get_event_manager() -> EventManager:
    """Get the global event manager instance"""
    global _global_event_manager
    if _global_event_manager is None:
        raise RuntimeError("Event manager not initialized! Call init_event_manager() first.")
    return _global_event_manager

def init_event_manager(debug_mode: bool = False) -> EventManager:
    """Initialize the global event manager"""
    global _global_event_manager
    if _global_event_manager is not None:
        logger.warning("Event manager already initialized!")
    _global_event_manager = EventManager(debug_mode=debug_mode)
    return _global_event_manager

def shutdown_event_manager() -> None:
    """Shutdown the global event manager"""
    global _global_event_manager
    _global_event_manager = None
