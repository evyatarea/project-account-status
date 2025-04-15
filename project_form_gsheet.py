import streamlit as st
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import json
from google.oauth2.service_account import Credentials

st.set_page_config(page_title="טופס סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")
# הגדרות
PROJECTS_FILE = "projects.xlsx"
GOOGLE_SHEET_NAME = "דיווחי פרויקטים"  # שנה לשם הגיליון שלך
CREDENTIALS_FILE = "credentials.json"

# התחברות ל-Google Sheets
@st.cache_resource
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_info(st.secrets["GOOGLE_CREDENTIALS"], scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

sheet = connect_to_gsheet()

# טעינת טבלת פרויקטים
@st.cache_data
def load_projects():
    return pd.read_excel(PROJECTS_FILE)

project_df = load_projects()

# ממשק המשתמש



manager_list = sorted(project_df['manager'].dropna().unique())
manager_name = st.selectbox("בחר את שמך", manager_list)

report_month = st.date_input("תאריך הדיווח", value=datetime.today())

if manager_name:
    relevant_projects = project_df[project_df['manager'].str.lower() == manager_name.lower()]

    if relevant_projects.empty:
        st.warning("לא נמצאו פרויקטים תחת שם זה.")
    else:
        st.success(f"נמצאו {len(relevant_projects)} פרויקטים")
        status_entries = []

        for _, row in relevant_projects.iterrows():
            st.subheader(f"📝 פרויקט: {row['project name']} (מספר {row['project number']})")
            status = st.selectbox(f"סטטוס החשבון:", ["לא הוגש", "הוגש", "שולם חלקית", "שולם במלואו"], key=row['project number'])
            amount = st.number_input(f'סכום לחודש זה (ש"ח):', min_value=0.0, step=1000.0, key=f"amount_{row['project number']}")
            status_entries.append({
                'Date': datetime.today().strftime('%Y-%m-%d'),
                'Manager': manager_name,
                'Project Number': row['project number'],
                'Project Name': row['project name'],
                'Month': report_month.strftime('%Y-%m'),
                'Status': status,
                'Amount': amount,
                'File Name': '',  # עתידי
                'Last Updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            })

        if st.button("שלח טופס"):
            for entry in status_entries:
                row_values = list(entry.values())
                sheet.append_row(row_values)
            st.success("הטופס נשלח ונשמר בגיליון ✅")
else:
    st.info("בחר את שמך כדי להתחיל.")
