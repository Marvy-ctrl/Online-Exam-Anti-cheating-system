import sys
from sqlalchemy import create_engine, text
import pandas as pd

# Use the credentials from docker-compose
engine = create_engine('postgresql://examloc:changeme@localhost:5433/examloc_db')

try:
    with engine.connect() as conn:
        print("Database connection successful!")
        
        # Check tables
        tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).fetchall()
        print("\nTables:")
        for t in tables:
            print(f" - {t[0]}")
            
        print("\nRecord Counts:")
        for t in tables:
            table_name = t[0]
            count = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
            print(f" - {table_name}: {count}")
            
except Exception as e:
    print(f"Error: {e}")
