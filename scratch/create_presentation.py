import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

# Initialize presentation
prs = Presentation()
# Set to 16:9 widescreen
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Color Palette Definitions (Premium dark layout)
DARK_BG = RGBColor(15, 23, 42)      # Slate 900
LIGHT_TEXT = RGBColor(248, 250, 252) # Slate 50
MUTED_TEXT = RGBColor(148, 163, 184) # Slate 400
ACCENT_BLUE = RGBColor(56, 189, 248) # Sky 400

def set_slide_background(slide):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = DARK_BG

def add_slide_header(slide, title_text, slide_num_str):
    # Header title text box
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(10.5), Inches(1.0))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    p = tf.paragraphs[0]
    p.text = title_text
    p.font.name = 'Arial'
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = LIGHT_TEXT
    
    # Slide number tag
    tb_num = slide.shapes.add_textbox(Inches(11.5), Inches(0.5), Inches(1.0), Inches(0.5))
    tf_num = tb_num.text_frame
    p_num = tf_num.paragraphs[0]
    p_num.text = slide_num_str
    p_num.alignment = PP_ALIGN.RIGHT
    p_num.font.name = 'Arial'
    p_num.font.size = Pt(14)
    p_num.font.bold = True
    p_num.font.color.rgb = ACCENT_BLUE

def add_bullet_slide(prs, title, slide_num, points, highlights=None):
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    set_slide_background(slide)
    add_slide_header(slide, title, slide_num)
    
    # Body text box
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(1.6), Inches(11.7), Inches(5.2))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    
    for i, pt in enumerate(points):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        # Set margin size based on list density
        p.space_after = Pt(12)
        p.level = 0
        
        # Base text formatting
        run = p.add_run()
        run.text = "•  " + pt
        run.font.name = 'Arial'
        run.font.size = Pt(18)
        run.font.color.rgb = LIGHT_TEXT
        
        # Apply highlighted phrases if defined
        if highlights and i < len(highlights) and highlights[i]:
            target_phrase = highlights[i]
            if target_phrase in pt:
                p.text = "•  " # Reset paragraph
                parts = pt.split(target_phrase, 1)
                
                # Pre-highlight text
                run1 = p.add_run()
                run1.text = parts[0]
                run1.font.name = 'Arial'
                run1.font.size = Pt(18)
                run1.font.color.rgb = LIGHT_TEXT
                
                # Highlighted text
                run_h = p.add_run()
                run_h.text = target_phrase
                run_h.font.name = 'Arial'
                run_h.font.size = Pt(18)
                run_h.font.bold = True
                run_h.font.color.rgb = ACCENT_BLUE
                
                # Post-highlight text
                run2 = p.add_run()
                run2.text = parts[1]
                run2.font.name = 'Arial'
                run2.font.size = Pt(18)
                run2.font.color.rgb = LIGHT_TEXT
    return slide

# ----------------- SLIDE 1: TITLE SLIDE -----------------
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_background(slide)

# Main Title text box
tb = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(11.7), Inches(3.2))
tf = tb.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Design and Implementation of an Intelligent Online Examination System with Real-Time Anti-Cheating Mechanisms (ExamLoc)"
p.font.name = 'Arial'
p.font.size = Pt(36)
p.font.bold = True
p.font.color.rgb = LIGHT_TEXT
p.space_after = Pt(10)

p2 = tf.add_paragraph()
p2.text = "A secure, multi-tier asynchronous examination platform utilizing biometric validation and real-time behavioral telemetries."
p2.font.name = 'Arial'
p2.font.size = Pt(18)
p2.font.color.rgb = MUTED_TEXT

# Metadata text box
tb_meta = slide.shapes.add_textbox(Inches(0.8), Inches(4.8), Inches(11.7), Inches(2.2))
tf_meta = tb_meta.text_frame

p_cand = tf_meta.paragraphs[0]
p_cand.text = "Student: Popoola Marvellous Ibukunoluwa  ·  Matric: 22/01DL103"
p_cand.font.name = 'Arial'
p_cand.font.size = Pt(16)
p_cand.font.bold = True
p_cand.font.color.rgb = ACCENT_BLUE
p_cand.space_after = Pt(4)

p_sup = tf_meta.add_paragraph()
p_sup.text = "Supervisor: Prof. A. O. Bajeh"
p_sup.font.name = 'Arial'
p_sup.font.size = Pt(14)
p_sup.font.color.rgb = LIGHT_TEXT
p_sup.space_after = Pt(4)

p_inst = tf_meta.add_paragraph()
p_inst.text = "Department of Computer Science, Centre for Open and Distance Learning, University of Ilorin"
p_inst.font.name = 'Arial'
p_inst.font.size = Pt(14)
p_inst.font.color.rgb = MUTED_TEXT
p_inst.space_after = Pt(4)

p_date = tf_meta.add_paragraph()
p_date.text = "June 2026"
p_date.font.name = 'Arial'
p_date.font.size = Pt(12)
p_date.font.color.rgb = MUTED_TEXT


# ----------------- SLIDE 2: PROBLEM STATEMENT -----------------
add_bullet_slide(
    prs,
    title="Problem Statement",
    slide_num="01 / 11",
    points=[
        "Lack of continuous, real-time identity verification during remote exams, allowing candidate impersonation or seat-swapping.",
        "Over-reliance on basic browser lockdowns that fail to monitor the candidate's physical workspace or detect off-camera help.",
        "Synchronous biometric image processing on the web gateway causes server performance degradation and freezes the exam screen."
    ],
    highlights=[
        "continuous, real-time identity verification",
        "fail to monitor the candidate's physical workspace",
        "causes server performance degradation and freezes the exam screen"
    ]
)

# ----------------- SLIDE 3: AIM -----------------
add_bullet_slide(
    prs,
    title="Project Aim",
    slide_num="02 / 11",
    points=[
        "To design and build a secure, real-time online exam system that checks the student's identity and monitors browser activity, without causing server lag or freezing the candidate's screen."
    ],
    highlights=[
        "verifies student identity and logs screen activities without causing server lag"
    ]
)

# ----------------- SLIDE 4: OBJECTIVES & GAPS -----------------
add_bullet_slide(
    prs,
    title="Objectives and Gaps Addressed",
    slide_num="03 / 11",
    points=[
        "Objective 1: Design and implement a client-side exam shell with browser focus monitors and a continuous biometric face verification pipeline.",
        "-> Addresses Gaps: Mitigates lack of continuous identity check (Gap 1) and locks down the physical presence window (Gap 2).",
        "Objective 2: Establish a decoupled backend architecture utilizing asynchronous task queues to offload heavy biometric comparisons.",
        "-> Addresses Gaps: Resolves server performance degradation and client-side page freezing (Gap 3)."
    ],
    highlights=[
        "Objective 1:",
        "Mitigates lack of continuous identity check (Gap 1) and locks down the physical presence window (Gap 2).",
        "Objective 2:",
        "Resolves server performance degradation and client-side page freezing (Gap 3)."
    ]
)

# ----------------- SLIDE 5: METHODOLOGY -----------------
add_bullet_slide(
    prs,
    title="Methodology",
    slide_num="04 / 11",
    points=[
        "Research Paradigm: Design Science Research (DSR) – focuses on building and evaluating an artifact (ExamLoc) to solve a security problem.",
        "Development Approach: Agile iterative prototyping – chosen over Waterfall to allow empirical calibration of biometric thresholds through testing cycles.",
        "System Architecture: Four-tier hybrid asynchronous model (Client Next.js tier, FastAPI Server tier, Celery/Redis Worker tier, PostgreSQL/MinIO Storage tier).",
        "Communication Protocols: REST HTTP (for auth and saving answers), WebSockets (for live violation streaming), and Redis Pub/Sub (for internal task messaging)."
    ],
    highlights=[
        "Design Science Research (DSR)",
        "Agile iterative prototyping",
        "Four-tier hybrid asynchronous model",
        "REST HTTP (for auth and saving answers), WebSockets (for live violation streaming), and Redis Pub/Sub"
    ]
)

# ----------------- SLIDE 6: IMPLEMENTATION 1 -----------------
add_bullet_slide(
    prs,
    title="Implementation Part 1: Client Shell & Biometrics",
    slide_num="05 / 11",
    points=[
        "Client Shell (Next.js): Captures webcam frames, disables context menu (right-click) and highlighting, tracks page visibility, and runs answer saving retry loops.",
        "Grayscale Quality Gate: Approximates grayscale luminance (must be >= 60) and Laplacian variance (must be >= 80) to reject dark or blurry snapshots.",
        "Face Localization: Employs Histogram of Oriented Gradients (HOG) via dlib; rejects photos containing zero or multiple faces.",
        "Feature Extraction: Uses a pre-trained ResNet-34 neural model to extract a 128-dimensional biometric coordinate vector."
    ],
    highlights=[
        "Client Shell (Next.js)",
        "Grayscale Quality Gate",
        "Face Localization",
        "Feature Extraction"
    ]
)

# ----------------- SLIDE 7: IMPLEMENTATION 2 -----------------
add_bullet_slide(
    prs,
    title="Implementation Part 2: Backend & WebSockets",
    slide_num="06 / 11",
    points=[
        "Web Server & Routing (FastAPI): Handles session gating and token auth using HttpOnly cookies to block XSS scripts.",
        "Asynchronous Worker Queue (Celery & Redis): Enqueues Base64 snapshots to Celery workers, switching to psycopg2 synchronous database adapters for process safety.",
        "Real-Time Broadcast (WebSockets): Features a connection registry (ConnectionManager) mapping active sockets to stream violations to examiner consoles.",
        "Storage Tiers (PostgreSQL & MinIO): Stores relational data (SQLModel) in PostgreSQL, and uploads violation snapshots to MinIO with a 7-day auto-delete policy."
    ],
    highlights=[
        "Web Server & Routing (FastAPI)",
        "Asynchronous Worker Queue (Celery & Redis)",
        "Real-Time Broadcast (WebSockets)",
        "Storage Tiers (PostgreSQL & MinIO)"
    ]
)

# ----------------- SLIDE 8: RESULTS 1 -----------------
add_bullet_slide(
    prs,
    title="Results Part 1: Accuracy & Functional Tests",
    slide_num="07 / 11",
    points=[
        "Biometric Threshold Calibration: Evaluated Euclidean distance levels to locate the optimal threshold (0.40).",
        "  - False Acceptance Rate (FAR): 0.08% (insignificant impersonation risk).",
        "  - False Rejection Rate (FRR): 1.20% (low false alarm rate for genuine candidates).",
        "Functional Integration Tests: 12 core test cases executed using pytest.",
        "  - Passed: Duplicate email rejects, quality gate filters, tab switch logs, copy-paste blocks, cookie auth, and power cut recovery."
    ],
    highlights=[
        "optimal threshold (0.40)",
        "0.08% (insignificant impersonation risk)",
        "1.20% (low false alarm rate for genuine candidates)",
        "12 core test cases",
        "Passed:"
    ]
)

# ----------------- SLIDE 9: RESULTS 2 -----------------
add_bullet_slide(
    prs,
    title="Results Part 2: Latency Analysis",
    slide_num="08 / 11",
    points=[
        "Response Latency (50 virtual concurrent users under Locust):",
        "  - Web Page Feedback (FastAPI): 18ms (instant response returned to student browser).",
        "  - Biometric Inference (Celery): 850ms (heavy processing runs in the background).",
        "  - Answer Save Sync Loop: 12ms (quick database transactions).",
        "  - WebSocket Broadcast: 45ms (instant proctor dashboard updates).",
        "Key Insight: Decoupling the web request loop from biometric calculations keeps the student's exam interface lag-free and guarantees sub-second page loads."
    ],
    highlights=[
        "50 virtual concurrent users under Locust",
        "18ms",
        "850ms",
        "12ms",
        "45ms",
        "keeps the student's exam interface lag-free"
    ]
)

# ----------------- SLIDE 10: FUTURE WORK -----------------
add_bullet_slide(
    prs,
    title="Recommendations for Future Work",
    slide_num="09 / 11",
    points=[
        "Incorporate WebGL-based eye-gaze tracking to detect if the student is looking away from the monitor.",
        "Integrate WebRTC protocol to stream continuous, multi-channel live video feeds to examiners.",
        "Run face detection on the client browser using WebAssembly to reduce server-side CPU costs.",
        "Expand the face verification training dataset to cover a wider range of background lighting and camera hardware.",
        "Develop an AI-based anomaly detector to predict behavioral cheating patterns over time.",
        "Integrate native mobile operating system locks for exams taken on tablets and smartphones."
    ],
    highlights=[
        "eye-gaze tracking",
        "stream continuous, multi-channel live video feeds",
        "using WebAssembly to reduce server-side CPU costs",
        "cover a wider range of background lighting",
        "AI-based anomaly detector",
        "native mobile operating system locks"
    ]
)

# ----------------- SLIDE 11: ACKNOWLEDGEMENTS -----------------
add_bullet_slide(
    prs,
    title="Acknowledgements",
    slide_num="10 / 11",
    points=[
        "Supervisor: Sincere thanks to Prof. A. O. Bajeh for his patient guidance, constant feedback, and support throughout this study.",
        "Head of Department: Gratitude to Prof. A. O. Ameen for providing departmental leadership and resources.",
        "Director, CODL: Sincere appreciation to Prof. Modinah A. O. Abdul Raheem for academic and institutional guidance.",
        "Department Staff: Thanks to all lecturers and staff of the Department of Computer Science, University of Ilorin.",
        "Support: Special thanks to my family and friends for their constant encouragement."
    ],
    highlights=[
        "Prof. A. O. Bajeh",
        "Prof. A. O. Ameen",
        "Prof. Modinah A. O. Abdul Raheem",
        "Department of Computer Science, University of Ilorin",
        "family and friends"
    ]
)

# ----------------- SLIDE 12: THANK YOU -----------------
blank_layout = prs.slide_layouts[6]
slide_end = prs.slides.add_slide(blank_layout)
set_slide_background(slide_end)

tb_end = slide_end.shapes.add_textbox(Inches(0.8), Inches(2.2), Inches(11.7), Inches(3.0))
tf_end = tb_end.text_frame
tf_end.word_wrap = True

p_end = tf_end.paragraphs[0]
p_end.text = "Thank You."
p_end.alignment = PP_ALIGN.CENTER
p_end.font.name = 'Arial'
p_end.font.size = Pt(64)
p_end.font.bold = True
p_end.font.color.rgb = LIGHT_TEXT
p_end.space_after = Pt(20)

p_qst = tf_end.add_paragraph()
p_qst.text = "Questions?"
p_qst.alignment = PP_ALIGN.CENTER
p_qst.font.name = 'Arial'
p_qst.font.size = Pt(36)
p_qst.font.bold = True
p_qst.font.color.rgb = ACCENT_BLUE

tb_end_meta = slide_end.shapes.add_textbox(Inches(0.8), Inches(5.8), Inches(11.7), Inches(1.0))
tf_end_meta = tb_end_meta.text_frame
p_meta = tf_end_meta.paragraphs[0]
p_meta.text = "Popoola Marvellous Ibukunoluwa (22/01DL103)"
p_meta.alignment = PP_ALIGN.CENTER
p_meta.font.name = 'Arial'
p_meta.font.size = Pt(16)
p_meta.font.bold = True
p_meta.font.color.rgb = MUTED_TEXT

# Save presentation
output_path = '/Users/macbook/Documents/projects/Online-Exam-Anti-cheating-system/report/presentation.pptx'
prs.save(output_path)
print(f"PowerPoint slides successfully saved to {output_path}")
