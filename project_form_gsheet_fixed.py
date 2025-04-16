import streamlit as st
import gspread
import json
from google.oauth2.service_account import Credentials

# הגדרת שם הגיליון
GOOGLE_SHEET_NAME = "Project Status Form"

# הגדרת החיבור ל-Google Sheets
@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    with open("credentials.json") as f:
        service_account_info = json.load(f)
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# הגדרות עמוד
st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

# ניסיון להתחבר לגוגל שיטס
try:
    sheet = connect_to_gsheet()
    st.success("החיבור ל-Google Sheets הצליח!")
except Exception as e:
    st.error(f"שגיאה בחיבור ל-Google Sheets: {e}")
