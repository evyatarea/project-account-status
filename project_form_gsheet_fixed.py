import streamlit as st
import gspread
import json
from datetime import datetime
from google.oauth2.service_account import Credentials

# התחברות ל-Google Sheets דרך st.secrets
def connect_to_gsheet():
    credentials_dict = json.loads(st.secrets["GOOGLE_CREDENTIALS"])
    scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    credentials = Credentials.from_service_account_info(credentials_dict, scopes=scopes)
    client = gspread.authorize(credentials)
    sheet = client.open(st.secrets["GOOGLE_SHEET_NAME"]).sheet1
    return sheet

st.title("🌐 בדיקת שליחה ל-Google Sheets")

try:
    sheet = connect_to_gsheet()
    st.success("החיבור ל-Google Sheets הצליח ✅")

    if st.button("שלח שורת בדיקה"):
        now = datetime.now()
        sheet.append_row([
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            "בדיקה"
        ])
        st.success("✅ נשלח בהצלחה!")

except Exception as e:
    st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
