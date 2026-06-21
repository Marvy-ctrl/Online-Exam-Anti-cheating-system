import matplotlib.pyplot as plt
import matplotlib.patches as patches
import matplotlib.path as mpath
import numpy as np

# Set up figure
fig, ax = plt.subplots(figsize=(15, 23))
ax.set_xlim(-1, 13)
ax.set_ylim(-17, 16)
ax.axis('off')

# Color palette (soft, professional pastel)
colors = {
    'start_end': '#ECEFF1',     # Light Grey
    'start_end_border': '#37474F',
    'enroll': '#E1F5FE',        # Soft Blue
    'enroll_border': '#0288D1',
    'gate': '#E8F5E9',          # Soft Green
    'gate_border': '#2E7D32',
    'active': '#FFF3E0',        # Soft Orange
    'active_border': '#EF6C00',
    'alert': '#FFEBEE',         # Soft Red
    'alert_border': '#C62828',
    'decision': '#FFF9C4',      # Soft Yellow
    'decision_border': '#FBC02D',
    'text_dark': '#1A1A1A',
    'text_light': '#FFFFFF'
}

def draw_node(ax, text, x, y, n_type='proc', color='#FFFFFF', border='#000000'):
    # Increased width and height for readability
    w, h = 3.6, 1.3
    if n_type in ['start', 'end']:
        # Draw rounded rectangle (start/end) with thick borders
        rect = patches.FancyBboxPatch((x - w/2, y - h/2), w, h, boxstyle="round,pad=0.1", facecolor=color, edgecolor=border, linewidth=3.5, zorder=3)
        ax.add_patch(rect)
    elif n_type == 'dec':
        # Draw diamond for decisions
        dw, dh = 2.3, 1.7
        pts = np.array([[x, y + dh/2], [x + dw, y], [x, y - dh/2], [x - dw, y]])
        diamond = patches.Polygon(pts, facecolor=color, edgecolor=border, linewidth=3.5, zorder=3)
        ax.add_patch(diamond)
    else:
        # Draw standard process node with thick borders
        rect = patches.FancyBboxPatch((x - w/2, y - h/2), w, h, boxstyle="round,pad=0.06", facecolor=color, edgecolor=border, linewidth=3.5, zorder=3)
        ax.add_patch(rect)
        
    # Text (Increased font size and bold weights for high contrast when zoomed out)
    fontsize = 12.5
    weight = 'bold'
    ax.text(x, y, text, ha='center', va='center', color=colors['text_dark'], fontsize=fontsize, zorder=4, weight=weight)

# Define Nodes (perfectly matching Chapter 3 Methodology text)
nodes = [
    # --- Enrollment Flow ---
    ('n1', '1. Admin Pre-Enrollment\nRegisters student credentials\nin admin panel', 2.0, 14.5, 'proc', colors['enroll'], colors['enroll_border']),
    ('n2', 'Generate single-use\nsecure link & token', 2.0, 12.5, 'proc', colors['enroll'], colors['enroll_border']),
    ('n3', '2. Student Enrollment\nOpens link, takes 5 webcam\nphotos for baseline', 2.0, 10.5, 'proc', colors['enroll'], colors['enroll_border']),
    ('n4', 'Capture 5 Photos &\nRun Quality Gate', 2.0, 8.5, 'dec', colors['decision'], colors['decision_border']),
    ('n4_retry', 'Retry Photo Capture', 5.2, 8.5, 'proc', colors['alert'], colors['alert_border']),
    ('n5', 'Average Embeddings &\nSave Baseline Template\n(Status: Enrolled)', 2.0, 6.5, 'proc', colors['enroll'], colors['enroll_border']),

    # --- Exam Session Verification Gate ---
    ('n6', '3. Exam Session\nVerification Gate', 6.5, 6.5, 'proc', colors['gate'], colors['gate_border']),
    ('n7', 'Capture Live Frame\n& Match Baseline', 6.5, 4.4, 'dec', colors['decision'], colors['decision_border']),
    ('n7_deny', 'Access Denied /\nFlag Face Mismatch', 10.5, 4.4, 'proc', colors['alert'], colors['alert_border']),
    ('n8', 'Issue JWT Token &\nStart Exam Countdown', 6.5, 2.3, 'proc', colors['gate'], colors['gate_border']),

    # --- Active Exam Shell ---
    ('n9', '4. Active Exam Shell &\nClient Monitoring', 6.5, 0.3, 'proc', colors['active'], colors['active_border']),

    # --- Branch A: Behavioral Monitoring ---
    ('n10_a', 'Tab Switch /\nFocus Loss?', 3.0, -1.8, 'dec', colors['decision'], colors['decision_border']),
    ('n10_a_log', 'HTTP POST: Log Violation\n& Send WS Alert', 3.0, -3.8, 'proc', colors['alert'], colors['alert_border']),

    # --- Branch B: Biometric Verification ---
    ('n10_b', 'Periodic webcam snapshot\nevery 20s', 10.0, -1.8, 'dec', colors['decision'], colors['decision_border']),
    ('n10_b_queue', 'FastAPI Queue Snapshot\nto Redis', 10.0, -3.8, 'proc', colors['gate'], colors['gate_border']),
    ('n10_b_celery', 'Celery Run Face Detection\n& Recognition', 10.0, -5.3, 'proc', colors['gate'], colors['gate_border']),
    ('n10_b_dec', 'Face Match /\nPresent?', 10.0, -6.8, 'dec', colors['decision'], colors['decision_border']),
    ('n10_b_log', 'MinIO: Save snapshot;\nDB: Increment count', 10.0, -8.4, 'proc', colors['alert'], colors['alert_border']),
    ('n10_b_alert', 'Redis Pub/Sub -> FastAPI\nWebSocket -> Proctor Alert', 10.0, -10.0, 'proc', colors['alert'], colors['alert_border']),

    # --- Exam Submission & Grading ---
    ('n12', '7. Final Submission or\nTimer Expiration', 6.5, -11.6, 'proc', colors['enroll'], colors['enroll_border']),
    ('n13', 'Celery Auto-grades\nMCQ responses', 6.5, -13.1, 'proc', colors['gate'], colors['gate_border']),
    ('n14', 'Save final score &\nGenerate audit report', 6.5, -14.6, 'proc', colors['enroll'], colors['enroll_border']),
    ('n15', 'End Session', 6.5, -16.1, 'end', colors['start_end'], colors['start_end_border'])
]

# Draw Nodes
for nid, text, x, y, n_type, col, border in nodes:
    draw_node(ax, text, x, y, n_type, col, border)

# Draw Arrows (Thicker and wider lines for zoom readability)
arrow_props = dict(facecolor='#333333', edgecolor='#222222', width=2.8, headwidth=11, shrink=0.08, zorder=1)

def draw_arrow(x1, y1, x2, y2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1), arrowprops=arrow_props)

def draw_bend_arrow(x1, y1, xb, yb, x2, y2):
    # Connect with a path containing a bend
    path_data = [
        (mpath.Path.MOVETO, (x1, y1)),
        (mpath.Path.LINETO, (xb, yb)),
        (mpath.Path.LINETO, (x2, y2)),
    ]
    codes, verts = zip(*path_data)
    path = mpath.Path(verts, codes)
    patch = patches.PathPatch(path, facecolor='none', edgecolor='#333333', linewidth=3.2, zorder=1)
    ax.add_patch(patch)
    # Head arrow annotation
    ax.annotate('', xy=(x2, y2), xytext=(xb, yb), arrowprops=dict(facecolor='#333333', edgecolor='#222222', width=0.1, headwidth=11, shrink=0.05))

# Connect Enrollment
draw_arrow(2.0, 14.5, 2.0, 12.5) # n1 -> n2
draw_arrow(2.0, 12.5, 2.0, 10.5) # n2 -> n3
draw_arrow(2.0, 10.5, 2.0, 8.5)  # n3 -> n4

# Connect n4 decision (Capture 5 Photos & Run Quality Gate)
draw_arrow(2.0, 8.5, 2.0, 6.5)    # n4 -> n5 (Pass)
ax.text(2.1, 7.3, 'Pass', color='green', fontweight='bold', fontsize=13)
draw_arrow(2.0, 8.5, 5.2, 8.5)    # n4 -> n4_retry (Fail)
ax.text(3.6, 8.7, 'Fail', color='red', fontweight='bold', fontsize=13)

# Connect n4_retry back to n3 (Student Enrollment)
draw_bend_arrow(5.2, 8.5, 5.2, 10.5, 2.0, 10.5)

# Connect Enrollment to Exam login Gate
draw_arrow(2.0, 6.5, 6.5, 6.5)

# Connect Exam Session Verification Gate to diamond
draw_arrow(6.5, 6.5, 6.5, 4.4)

# Connect Verification Gate Decision (Match Baseline)
draw_arrow(6.5, 4.4, 6.5, 2.3)    # n7 -> n8 (Yes)
ax.text(6.7, 3.2, 'Euclidean Dist < 0.40', color='green', fontweight='bold', fontsize=12)
draw_arrow(6.5, 4.4, 10.5, 4.4)  # n7 -> n7_deny (No)
ax.text(8.3, 4.5, 'Euclidean Dist >= 0.40', color='red', fontweight='bold', fontsize=12)

# Connect success to Active Exam Shell
draw_arrow(6.5, 2.3, 6.5, 0.3)

# Connect Active Exam Shell to Branch A (Behavioral)
draw_bend_arrow(6.5, 0.3, 3.0, 0.3, 3.0, -1.8)
draw_arrow(3.0, -1.8, 3.0, -3.8) # n10_a -> n10_a_log
ax.text(2.5, -2.8, 'Yes', color='red', fontweight='bold', fontsize=13)

# Connect Active Exam Shell to Branch B (Biometrics)
draw_bend_arrow(6.5, 0.3, 10.0, 0.3, 10.0, -1.8)
draw_arrow(10.0, -1.8, 10.0, -3.8) # n10_b -> n10_b_queue
draw_arrow(10.0, -3.8, 10.0, -5.3) # n10_b_queue -> n10_b_celery
draw_arrow(10.0, -5.3, 10.0, -6.8) # n10_b_celery -> n10_b_dec
draw_arrow(10.0, -6.8, 10.0, -8.4) # n10_b_dec -> n10_b_log
ax.text(10.1, -7.6, 'No / Mismatch', color='red', fontweight='bold', fontsize=12)
draw_arrow(10.0, -8.4, 10.0, -10.0) # n10_b_log -> n10_b_alert

# Connect Active Exam Shell directly to submission path
draw_arrow(6.5, 0.3, 6.5, -11.6)

# Connect Submission to end
draw_arrow(6.5, -11.6, 6.5, -13.1)
draw_arrow(6.5, -13.1, 6.5, -14.6)
draw_arrow(6.5, -14.6, 6.5, -16.1)

# Add Phase Dividers & Titles (Increased sizes)
def draw_section_header(text, y, color):
    ax.axhline(y, color=color, linestyle='--', alpha=0.5, linewidth=2.5)
    ax.text(-0.5, y + 0.3, text, color=color, fontweight='bold', fontsize=15)

draw_section_header('PHASE 1: BIOMETRIC ENROLLMENT', 15.6, '#0288D1')
draw_section_header('PHASE 2: SESSION INITIALIZATION GATE', 7.6, '#2E7D32')
draw_section_header('PHASE 3: CONTINUOUS ACTIVE PROCTORING', 1.3, '#EF6C00')
draw_section_header('PHASE 4: LIVE MONITORING & ALERTS', -9.2, '#C62828')
draw_section_header('PHASE 5: SESSION TERMINATION & GRADING', -10.9, '#37474F')

plt.tight_layout()
# Saved with double resolution (600 DPI) for extreme zoom-in detail
plt.savefig('/Users/macbook/Documents/projects/Online-Exam-Anti-cheating-system/report/images/system_flowchart.png', dpi=600, bbox_inches='tight')
print("Flowchart image successfully created at report/images/system_flowchart.png")
