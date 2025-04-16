import streamlit as st
import gspread
import pandas as pd
import json
from datetime import date, datetime
from google.oauth2.service_account import Credentials

# שם הגיליון בגוגל שיטס
GOOGLE_SHEET_NAME = "Project Status Form"

# התחברות ל-Google Sheets דרך secrets
@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    service_account_info = json.loads(st.secrets["GOOGLE_CREDENTIALS"])
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# טעינת טבלת הפרויקטים
@st.cache_data
def load_projects():
    df = pd.read_excel("projects.xlsx")
    return df

# הגדרות עמוד
st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

try:
    sheet = connect_to_gsheet()
    st.success("✅ החיבור ל-Google Sheets הצליח")

    # טען את טבלת הפרויקטים
    project_df = load_projects()

    # שלב 1 – בחירת מנהל מתוך רשימה
    manager_list = project_df["manager"].dropna().unique().tolist()
    selected_manager = st.selectbox("מה שמך?", [""] + manager_list)

    if selected_manager:
        manager_projects = project_df[project_df["manager"] == selected_manager]

        for _, row in manager_projects.iterrows():
            with st.form(key=f"form_{row['project number']}"):
                st.subheader(f"📝 פרויקט: {row['project name']} ({row['project number']})")
                amount = st.number_input("סכום לחיוב/דיווח החודש (ש״ח):", min_value=0.0, step=100.0, format="%.2f", value=None)
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
                        "",  # File Name
                        last_update
                    ])
                    st.success("✅ הדיווח נשלח בהצלחה!")

except Exception as e:
    st.error(f"שגיאה בחיבור ל-Google Sheets: {e}")
