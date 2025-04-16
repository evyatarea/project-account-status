import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

# הגדרת שם הגיליון
GOOGLE_SHEET_NAME = "Project Status Form"

# התחברות ל-Google Sheets
@st.cache_resource
def connect_to_gsheet():
    scopes = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_info(st.secrets["GOOGLE_CREDENTIALS"], scopes=scopes)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

st.set_page_config(page_title="בדיקת שליחה פשוטה", layout="centered")
st.title("🚀 טופס בדיקה פשוטה")

# כפתור שליחה
if st.button("שלח שורה לבדיקה"):
    try:
        sheet = connect_to_gsheet()

        now = datetime.now()
        date_str = now.date().isoformat()
        time_str = now.strftime("%H:%M:%S")

        # שליחה של שורה קבועה
        row = [date_str, "בודק", "123", "בדיקת מערכת", "2025-04", "נשלח", 0, "", now.strftime("%Y-%m-%d %H:%M:%S")]
        sheet.append_row(row)

        st.success("✅ השורה נשלחה בהצלחה!")
        st.write("📝 הנתונים שנשלחו:")
        st.json(row)

    except Exception as e:
        st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
