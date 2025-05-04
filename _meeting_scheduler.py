import streamlit as st
import gspread
from google.oauth2.service_account import Credentials

def show_meeting_scheduler():
    st.header("שיבוץ פגישה")

    # התחברות לשירות
    scope = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_info(
        st.secrets["gcp_service_account"], scopes=scope
    )
    client = gspread.authorize(creds)
    spreadsheet = client.open("project_reporting")
    sheet = spreadsheet.worksheet("פגישות")

    # טופס
    manager = st.text_input("שם מנהל")
    date = st.date_input("תאריך הפגישה")
    hour = st.selectbox("שעה", [f"{h}:00" for h in range(9, 18)])

    # שליפת פגישות קיימות
    existing = sheet.get_all_records()

    # בדיקה האם הפגישה כבר קיימת
    already_booked = any(
        str(row["תאריך"]) == str(date) and row["שעה"] == hour
        for row in existing
    )

    if st.button("שמור פגישה"):
        if not manager:
            st.warning("אנא הכנס שם מנהל")
        elif already_booked:
            st.error(f"השעה {hour} בתאריך {date.strftime('%d/%m/%Y')} כבר תפוסה.")
        else:
            sheet.append_row([str(date), hour, manager])
            st.success("הפגישה נשמרה בהצלחה!")
