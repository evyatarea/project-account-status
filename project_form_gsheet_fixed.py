import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import json

@st.cache_resource
def connect_to_sheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds_dict = json.loads(st.secrets["GOOGLE_CREDENTIALS"])  # ← הפתרון לשגיאה!
    creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open("Project Status Form").sheet1
    return sheet

st.title("🔁 בדיקת שליחה ל-Google Sheets")

if st.button("שלח שורת בדיקה"):
    try:
        sheet = connect_to_sheet()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        sheet.append_row(["תאריך בדיקה", now, "123", "פרויקט בדיקה", "2025-04", "הוגש", "15000", "קובץ_דמה.pdf", now])
        st.success("✅ נשלח בהצלחה!")
    except Exception as e:
        st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
