import streamlit as st
import gspread
import json
from google.oauth2.service_account import Credentials

# שם הגיליון שאתה עובד איתו
GOOGLE_SHEET_NAME = "Project Status Form"

# חיבור ל-Google Sheets דרך Streamlit secrets
@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    service_account_info = json.loads(st.secrets["GOOGLE_CREDENTIALS"])
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# הגדרות עמוד
st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

# ניסיון חיבור
try:
    sheet = connect_to_gsheet()
    st.success("🔗 החיבור ל-Google Sheets הצליח ✅")
    st.write("🔍 גיליון נטען:", sheet)
except Exception as e:
    st.error("❌ שגיאה אמיתית בחיבור ל-Google Sheets:")
    st.exception(e)
