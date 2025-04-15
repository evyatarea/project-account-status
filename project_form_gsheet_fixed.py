import streamlit as st
import gspread
import json
from google.oauth2.service_account import Credentials

GOOGLE_SHEET_NAME = "Project Status Form"

@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    service_account_info = json.loads(st.secrets["GOOGLE_CREDENTIALS"])
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# טופס בסיסי לדוגמה
st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

try:
    sheet = connect_to_gsheet()
    st.success("החיבור ל-Google Sheets הצליח!")
except Exception as e:
    st.error(f"שגיאה בחיבור ל-Google Sheets: {e}")