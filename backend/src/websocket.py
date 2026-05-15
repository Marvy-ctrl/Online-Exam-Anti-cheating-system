from fastapi import WebSocket
from typing import Dict, List, Set
import json

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
        print(f"Student {student_uid} connected. Active: {len(self.active_student_connections[student_uid])}")

    def disconnect_student(self, websocket: WebSocket, student_uid: str):
        if student_uid in self.active_student_connections:
            if websocket in self.active_student_connections[student_uid]:
                self.active_student_connections[student_uid].remove(websocket)
            if not self.active_student_connections[student_uid]:
                del self.active_student_connections[student_uid]
        print(f"Student {student_uid} disconnected")

    async def connect_monitor(self, websocket: WebSocket, exam_uid: str):
        await websocket.accept()
        if exam_uid not in self.exam_monitors:
            self.exam_monitors[exam_uid] = []
        self.exam_monitors[exam_uid].append(websocket)
        print(f"Monitor joined exam {exam_uid}")

    def disconnect_monitor(self, websocket: WebSocket, exam_uid: str):
        if exam_uid in self.exam_monitors:
            if websocket in self.exam_monitors[exam_uid]:
                self.exam_monitors[exam_uid].remove(websocket)
            if not self.exam_monitors[exam_uid]:
                del self.exam_monitors[exam_uid]
        print(f"Monitor left exam {exam_uid}")

    async def notify_monitor(self, exam_uid: str, data: dict):
        """Send violation or status update to examiners watching this exam"""
        if exam_uid in self.exam_monitors:
            print(f"📡 Broadcasting to {len(self.exam_monitors[exam_uid])} monitors for exam {exam_uid}")
            disconnected = []
            for connection in self.exam_monitors[exam_uid]:
                try:
                    await connection.send_text(json.dumps(data))
                except Exception as e:
                    print(f"❌ Failed to send to monitor: {e}")
                    disconnected.append(connection)
            
            for conn in disconnected:
                self.disconnect_monitor(conn, exam_uid)
        else:
            print(f"⚠️ No active monitors for exam {exam_uid}")

    async def send_to_student(self, student_uid: str, message: str):
        if student_uid in self.active_student_connections:
            for connection in self.active_student_connections[student_uid]:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass

manager = ConnectionManager()
