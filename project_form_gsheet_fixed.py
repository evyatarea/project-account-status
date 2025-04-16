import streamlit as st
import gspread
import json
import pandas as pd
from datetime import date, datetime
from google.oauth2.service_account import Credentials

# שם הגיליון ב-Google Sheets
GOOGLE_SHEET_NAME = "Project Status Form"

# חיבור ל-Google Sheets דרך קובץ הסודות של Streamlit
@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    service_account_info = json.loads(st.secrets["GOOGLE_CREDENTIALS"])  # המרה ממחרוזת ל־dict
    creds = Credentials.from_service_account_info(service_account_info, scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# טעינת טבלת הפרויקטים מהאקסל
@st.cache_data
def load_projects():
    return pd.read_excel("projects.xlsx")

# הגדרות העמוד
st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

try:
    sheet = connect_to_gsheet()
    st.success("✅ החיבור ל-Google Sheets הצליח")

    # טען את רשימת הפרויקטים
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
                        st.error(f"שגיאה בשליחה ל-Google Sheets: {e}")

except Exception as e:
    st.error(f"שגיאה בחיבור ל-Google Sheets: {e}")
