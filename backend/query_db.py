from sqlalchemy import create_engine
import pandas as pd
engine = create_engine('postgresql://postgres:postgres@localhost:5433/examloc')
print("Violations:")
print(pd.read_sql("SELECT * FROM violation", engine))
print("Snapshots:")
print(pd.read_sql("SELECT uid, session_uid, violation_type, image_path FROM snapshot", engine))
