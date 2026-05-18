import redis

r = redis.Redis.from_url("redis://localhost:6379/0")
print("Redis Keys:", r.keys("*"))
for k in r.keys("*"):
    try:
        t = r.type(k).decode()
        if t == "list":
            print(f"Queue {k.decode()}: length {r.llen(k)}")
    except Exception as e:
        print(f"Error checking {k}: {e}")
