import streamlit as st
import gspread
import pandas as pd
from datetime import datetime, date
from google.oauth2.service_account import Credentials

# קונפיגורציה
GOOGLE_SHEET_NAME = "Project Status Form"
GOOGLE_CREDENTIALS_FILE = "streamlit-project-form-240a663d337b.json"

# התחברות ל־Google Sheets
@st.cache_data
def connect_to_sheet():
    scope = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_file(GOOGLE_CREDENTIALS_FILE, scopes=scope)
    client = gspread.authorize(creds)
    return client.open(GOOGLE_SHEET_NAME).sheet1

# טעינת טבלת פרויקטים
@st.cache_data
def load_projects():
    return pd.read_excel("projects.xlsx")

# UI
st.set_page_config("דיווח סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

try:
    sheet = connect_to_sheet()
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
                    today = date.today().isoformat()
                    month = today[:7]
                    last_update = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    sheet.append_row([
                        today,
                        selected_manager,
                        str(row["project number"]),
                        row["project name"],
                        month,
                        status,
                        amount,
                        "",
                        last_update
                    ])
                    st.success("✅ הדיווח נשלח בהצלחה!")

except Exception as e:
    st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")
