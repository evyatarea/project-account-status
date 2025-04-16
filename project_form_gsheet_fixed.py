import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import json
import pandas as pd

@st.cache_resource
def connect_to_sheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds_dict = json.loads(st.secrets["GOOGLE_CREDENTIALS"])  # ← הפתרון לשגיאה!
    creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open("Project Status Form").sheet1
    return sheet

@st.cache_data
def load_projects():
    return pd.read_excel("projects.xlsx")

# שלב 1 – בחירת שם מנהל
project_df = load_projects()
manager_list = project_df["manager"].dropna().unique().tolist()
selected_manager = st.selectbox("מה שמך?", [""] + manager_list)

if selected_manager:
    manager_projects = project_df[project_df["manager"] == selected_manager]

    for _, row in manager_projects.iterrows():
        with st.form(key=f"form_{row['project number']}"):
            st.subheader(f"📝 פרויקט: {row['project name']} ({row['project number']})")

            amount = st.text_input("סכום לחיוב/דיווח החודש (ש״ח):")
            status = st.selectbox("סטטוס החשבון", ["", "טרם הוגש", "הוגש", "מאושר"])
            submitted = st.form_submit_button("שלח")

            if submitted:
                try:
                    sheet = connect_to_sheet()
                    now = datetime.now()
                    today = now.strftime("%Y-%m-%d")
                    month = today[:7]
                    last_update = now.strftime("%Y-%m-%d %H:%M:%S")

                    sheet.append_row([
                        today,
                        selected_manager,
                        str(row["project number"]),
                        row["project name"],
                        month,
                        status,
                        amount,
                        "",  # שם קובץ אם יהיה בעתיד
                        last_update
                    ])
                    st.success("✅ הדיווח נשלח בהצלחה!")

                except Exception as e:
                    st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
