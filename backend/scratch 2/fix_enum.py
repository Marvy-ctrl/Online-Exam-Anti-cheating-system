# import asyncio
# import os
# from sqlalchemy.ext.asyncio import create_async_engine
# from sqlalchemy import text
# from .config import Config

# DATABASE_URL = os.getenv(Config.DATABASE_URL)

# async def fix():
#     engine = create_async_engine(DATABASE_URL)
#     async with engine.begin() as conn:
#         # Check current enum values
#         res = await conn.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'violation_type'"))
#         current_values = [row[0] for row in res]
#         print(f"Current values: {current_values}")
        
#         # Add "Focus Loss" if missing
#         if "Focus Loss" not in current_values:
#             print("Adding 'Focus Loss'...")
#             # Enums can't be updated inside a transaction easily in some PG versions, 
#             # but we'll try the ALTER TYPE command.
#             # Note: ALTER TYPE ... ADD VALUE cannot be executed in a transaction block
#             pass

#     if "Focus Loss" not in current_values:
#         # Run outside transaction
#         async with engine.connect() as conn:
#             await conn.execute(text("COMMIT")) # Ensure we are not in a transaction
#             try:
#                 await conn.execute(text("ALTER TYPE violation_type ADD VALUE 'Focus Loss'"))
#                 print("Added 'Focus Loss' successfully")
#             except Exception as e:
#                 print(f"Failed to add 'Focus Loss': {e}")
            
#             try:
#                 await conn.execute(text("ALTER TYPE violation_type ADD VALUE 'focus_loss'"))
#                 print("Added 'focus_loss' successfully")
#             except Exception as e:
#                 print(f"Failed to add 'focus_loss': {e}")

#     await engine.dispose()

# if __name__ == "__main__":
#     asyncio.run(fix())
