import streamlit as st
import gspread
from datetime import datetime
from google.oauth2.service_account import Credentials

# התחברות ל-Google Sheets דרך secrets
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_info(
        st.secrets["GOOGLE_CREDENTIALS"], scopes=scope
    )
    client = gspread.authorize(creds)
    sheet = client.open(st.secrets["GOOGLE_SHEET_NAME"]).sheet1
    return sheet

# ממשק
st.set_page_config(page_title="בדיקת שליחה", layout="centered")
st.title("📤 טופס בדיקה לשליחה ל-Google Sheets")

try:
    sheet = connect_to_gsheet()
    st.success("✅ התחברות הצליחה!")

    if st.button("שלח בדיקה"):
        now = datetime.now()
        sheet.append_row([
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            "Streamlit Test",
            "בדיקה"
        ])
        st.success("✅ הנתונים נשלחו!")

except Exception as e:
    st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
