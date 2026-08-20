import subprocess
import re

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    return result.stdout, result.stderr

def print_stats(name, times):
    if times:
        avg_time = sum(times) / len(times)
        min_time = min(times)
        max_time = max(times)
        print(f"{name}:")
        print(f"  Count: {len(times)}")
        print(f"  Average: {avg_time:.2f} ms")
        print(f"  Min: {min_time:.2f} ms")
        print(f"  Max: {max_time:.2f} ms")
    else:
        print(f"No logs found for {name}.")

print("=== Analyzing Docker Logs ===")

# 1. Face Frame Processing (Celery task verify_face_task)
stdout, stderr = run_cmd("docker logs examloc-faceworker 2>&1")
face_times = []
for line in stdout.splitlines():
    if "verify_face_task" in line and "succeeded in" in line:
        match = re.search(r"succeeded in ([\d\.]+)s", line)
        if match:
            face_times.append(float(match.group(1)) * 1000) # convert to ms
print_stats("Face Frame Processing (Celery verify_face_task)", face_times)

# 2. Email Tasks (Celery send_result_email_task)
stdout, stderr = run_cmd("docker logs examloc-emailworker 2>&1")
email_times = []
for line in stdout.splitlines():
    if "send_result_email_task" in line and "succeeded in" in line:
        match = re.search(r"succeeded in ([\d\.]+)s", line)
        if match:
            email_times.append(float(match.group(1)) * 1000)
print_stats("Email Task (Celery send_result_email_task)", email_times)

# 3. Grading Tasks (Celery grade_and_notify_task - parsed from examloc-api container logs)
stdout, stderr = run_cmd("docker logs examloc-api 2>&1")
grading_times = []
for line in stdout.splitlines():
    if "grade_and_notify_task" in line and "succeeded in" in line:
        match = re.search(r"succeeded in ([\d\.]+)s", line)
        if match:
            grading_times.append(float(match.group(1)) * 1000)
print_stats("Grading Task (Celery grade_and_notify_task via API container)", grading_times)
