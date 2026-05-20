import sys
import os
import asyncio

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from src.db.main import async_session_maker
from src.db.models import Snapshot
from sqlmodel import select

async def main():
    async with async_session_maker() as session:
        # Fetch the most recent 30 snapshots
        stmt = select(Snapshot).order_by(Snapshot.timestamp.desc()).limit(30)
        res = await session.exec(stmt)
        snapshots = res.all()
        
        print(f"Found {len(snapshots)} snapshots in the database:\n")
        for s in snapshots:
            print(f"UID: {s.uid}")
            print(f"Session UID: {s.session_uid}")
            print(f"Image Path: {s.image_path[:100]}")
            print(f"Object Key: {s.object_key}")
            print(f"Timestamp: {s.timestamp}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
