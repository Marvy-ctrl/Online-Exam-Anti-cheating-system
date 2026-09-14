from fastapi import WebSocket
from typing import Dict, List
import json
from src.core.logger import get_logger


logger = get_logger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps student_uid -> list of active WebSocket connections
        self.active_student_connections: Dict[str, List[WebSocket]] = {}
        # Maps exam_uid -> set of examiner/admin WebSockets watching that exam
        self.exam_monitors: Dict[str, List[WebSocket]] = {}

    async def connect_student(self, websocket: WebSocket, student_uid: str):
        # WebSocket is already accepted in the route handler
        if student_uid not in self.active_student_connections:
            self.active_student_connections[student_uid] = []
        self.active_student_connections[student_uid].append(websocket)
        logger.info(
            "Student websocket connected",
            student_uid=student_uid,
            active_connections=len(self.active_student_connections[student_uid]),
        )

    def disconnect_student(self, websocket: WebSocket, student_uid: str):
        if student_uid in self.active_student_connections:
            if websocket in self.active_student_connections[student_uid]:
                self.active_student_connections[student_uid].remove(websocket)
            if not self.active_student_connections[student_uid]:
                del self.active_student_connections[student_uid]
        logger.info("Student websocket disconnected", student_uid=student_uid)

    async def connect_monitor(self, websocket: WebSocket, exam_uid: str):
        await websocket.accept()
        if exam_uid not in self.exam_monitors:
            self.exam_monitors[exam_uid] = []
        self.exam_monitors[exam_uid].append(websocket)
        logger.info("Exam monitor connected", exam_uid=exam_uid)

    def disconnect_monitor(self, websocket: WebSocket, exam_uid: str):
        if exam_uid in self.exam_monitors:
            if websocket in self.exam_monitors[exam_uid]:
                self.exam_monitors[exam_uid].remove(websocket)
            if not self.exam_monitors[exam_uid]:
                del self.exam_monitors[exam_uid]
        logger.info("Exam monitor disconnected", exam_uid=exam_uid)

    async def notify_monitor(self, exam_uid: str, data: dict):
        """Send violation or status update to examiners watching this exam"""
        if exam_uid in self.exam_monitors:
            logger.debug(
                "Broadcasting exam update",
                exam_uid=exam_uid,
                monitor_count=len(self.exam_monitors[exam_uid]),
            )
            disconnected = []
            for connection in self.exam_monitors[exam_uid]:
                try:
                    await connection.send_text(json.dumps(data))
                except Exception as exc:
                    logger.warning(
                        "Exam monitor delivery failed",
                        exam_uid=exam_uid,
                        error_type=type(exc).__name__,
                    )
                    disconnected.append(connection)
            
            for conn in disconnected:
                self.disconnect_monitor(conn, exam_uid)
        else:
            logger.debug("No active monitors for exam update", exam_uid=exam_uid)

    async def send_to_student(self, student_uid: str, message: str):
        if student_uid in self.active_student_connections:
            for connection in self.active_student_connections[student_uid]:
                try:
                    await connection.send_text(message)
                except Exception as exc:
                    logger.warning(
                        "Student websocket delivery failed",
                        student_uid=student_uid,
                        error_type=type(exc).__name__,
                    )

manager = ConnectionManager()
