
import asyncio
from sqlalchemy import text
from src.db.main import engine

async def check_enum():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT enum_range(NULL::violation_type);"))
        row = result.fetchone()
        print(f"Enum values: {row[0]}")

if __name__ == "__main__":
    asyncio.run(check_enum())
