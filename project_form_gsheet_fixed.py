import streamlit as st
import gspread
import pandas as pd
from google.oauth2.service_account import Credentials

# קביעת שם הגיליון בגוגל שיטס
GOOGLE_SHEET_NAME = "Project Status Form"

# הגדרת החיבור לגוגל שיטס
@st.cache_data
def connect_to_gsheet():
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_service_account_info(st.secrets["GOOGLE_CREDENTIALS"], scopes=scope)
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

# טוען את קובץ האקסל עם רשימת הפרויקטים
@st.cache_data
def load_projects():
    df = pd.read_excel("projects.xlsx")
    return df

# קונפיגורציית עמוד
st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

try:
    sheet = connect_to_gsheet()
    st.success("החיבור ל-Google Sheets הצליח ✅")

    # טוען את הנתונים מהאקסל
    project_df = load_projects()

    # שלב 1: בחירת מנהל
    manager_list = project_df["manager"].dropna().unique().tolist()
    selected_manager = st.selectbox("בחר שם מנהל הפרויקט", manager_list)

    # שלב 2: סינון פרויקטים
    manager_projects = project_df[project_df["manager"] == selected_manager]

    for _, row in manager_projects.iterrows():
        with st.form(key=f"form_{row['project number']}"):
            st.subheader(f"📝 פרויקט: {row['project name']} ({row['project number']})")
            amount = st.number_input(f"סכום לחיוב/דיווח החודש (ש\'ח):", min_value=0.0, step=100.0, format="%.2f")
            status = st.selectbox("סטטוס החשבון", ["טרם הוגש", "הוגש", "מאושר"])
            submitted = st.form_submit_button("שלח")

            if submitted:
                sheet.append_row([selected_manager, str(row['project number']), row['project name'], amount, status])
                st.success(":white_check_mark: הדיווח נשלח בהצלחה!")

except Exception as e:
    st.error(f"שגיאה בחיבור ל-Google Sheets: {e}")
