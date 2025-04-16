import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
import json
from datetime import datetime

# התחברות לגוגל שיטס דרך טעינת המפתח עם json.loads
def connect_to_gsheet():
    scope = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive"
    ]
    service_account_info = json.loads(st.secrets["GOOGLE_CREDENTIALS"])
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(st.secrets["GOOGLE_SHEET_NAME"]).sheet1
    return sheet

# כותרת
st.title("בדיקת שליחה ל-Google Sheets")

try:
    sheet = connect_to_gsheet()
    st.success("✅ התחברות ל-Google Sheets הצליחה")

    if st.button("שלח שורת בדיקה"):
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        sheet.append_row([date_str, time_str, "בדיקה מ-Streamlit"])
        st.success("✅ שורה נשלחה בהצלחה!")

except Exception as e:
    st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
