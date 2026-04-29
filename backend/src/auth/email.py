import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.config import Config


def send_email(to_email: str, subject: str, html_content: str) -> None:
    """
    Synchronous SMTP email send.
    Must be called via FastAPI BackgroundTasks — never directly in an async route,
    as smtplib is blocking.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = Config.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        # Use SMTP_SSL on Port 465 to bypass normal ISP port blocks
        with smtplib.SMTP_SSL(Config.SMTP_HOST, 465, timeout=15) as server:
            server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
            server.sendmail(Config.SMTP_FROM, to_email, msg.as_string())
    # except Exception as e:
    #     print(f"\n[NETWORK BLOCK] Failed to send email to {to_email}. Error: {e}")
    #     print("Falling back to local console verification...")
    #     raise ValueError("SMTP_BLOCKED")
    except Exception as e:
        print(f"\n[NETWORK BLOCK] Failed to send email to {to_email}. Error: {e}")
        print("Falling back to local console verification...")


def send_verification_email(to_email: str, token: str) -> None:
    """
    Send an account verification email to a newly registered examiner.
    The token is a URL-safe timed token that expires in 1 hour.
    """
    # verification_url = (
    #     f"{Config.FRONTEND_URL}/api/v1/auth/verify-email?token={token}"
    # )
    verification_url = f"{Config.FRONTEND_URL}/verify-email?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
        <h2>Verify your Examiner Account</h2>
        <p>Thank you for signing up. Click the button below to verify your email address and activate your account.</p>
        <a href="{verification_url}"
           style="display: inline-block; padding: 12px 24px; background-color: #4f46e5;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Verify Email Address
        </a>
        <p style="color: #666; font-size: 14px;">This link expires in <strong>1 hour</strong>.</p>
        <p style="color: #666; font-size: 14px;">
            If you did not create an account, you can safely ignore this email.
        </p>
    </body>
    </html>
    """
    try:
        send_email(to_email, "Verify your ExamGuard Account", html)
    except ValueError:
        print("\n\n" + "="*50)
        print("🚨 MANUALLY VERIFY YOUR ACCOUNT TO CONTINUE 🚨")
        print("Click this link since your network blocked the email:")
        print("VERIFY LINK:", verification_url)
        print("="*50 + "\n\n")

def send_exam_invitation_email(to_email: str, exam_title: str, enrollment_url: str, custom_message: str = "") -> None:
    """
    Send an exam enrollment invitation to a student.
    """
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
        <h2 style="color: #2563EB;">Exam Invitation: {exam_title}</h2>
        <p>You have been invited to participate in the examination <strong>{exam_title}</strong>.</p>
        
        {f'<p style="background: #f3f4f6; padding: 15px; border-left: 4px solid #4f46e5; font-style: italic;">{custom_message}</p>' if custom_message else ""}
        
        <p>Please click the button below to complete your enrollment and verify your identity before the exam starts.</p>
        
        <a href="{enrollment_url}"
           style="display: inline-block; padding: 12px 24px; background-color: #2563EB;
                  color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Enroll for Exam
        </a>
        
        <p style="color: #666; font-size: 14px;">If you have trouble clicking the button, copy and paste this link into your browser:</p>
        <p style="color: #4f46e5; font-size: 12px;">{enrollment_url}</p>
        
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This invitation was sent by your institution via the Anti-Cheating Exam System.
        </p>
    </body>
    </html>
    """
    send_email(to_email, f"Invitation: {exam_title}", html)
