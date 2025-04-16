import streamlit as st
import gspread
import json
import pandas as pd
from datetime import date, datetime
from google.oauth2.service_account import Credentials

# שם הגיליון ב-Google Sheets
GOOGLE_SHEET_NAME = "Project Status Form"

# חיבור ל-Google Sheets דרך קובץ הסודות של Streamlit
@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    service_account_info = json.loads(st.secrets["GOOGLE_CREDENTIALS"])  # המרה ממחרוזת ל־dict
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# טעינת טבלת הפרויקטים מהאקסל
@st.cache_data
def load_projects():
    return pd.read_excel("projects.xlsx")

# הגדרות העמוד
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
