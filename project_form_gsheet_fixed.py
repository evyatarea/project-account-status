import streamlit as st
import gspread
from google.oauth2.service_account import Credentials

GOOGLE_SHEET_NAME = "Project Status Form"

# התחברות לגיליון עם הסקרטס
@st.cache_resource
def connect_to_sheet():
    scope = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_info(
        st.secrets["GOOGLE_CREDENTIALS"],
        scopes=scope
    )
    client = gspread.authorize(creds)
    sheet = client.open(GOOGLE_SHEET_NAME).sheet1
    return sheet

st.set_page_config(page_title="סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס חודשי למנהלי פרויקטים")

# טופס
with st.form("status_form"):
    name = st.text_input("שם מנהל הפרויקט")
    project = st.text_input("שם הפרויקט")
    status = st.selectbox("סטטוס חודשי", ["בוצע", "בתהליך", "עיכוב", "לא התחיל"])
    submitted = st.form_submit_button("שלח")

    if submitted:
        try:
            sheet = connect_to_sheet()
            sheet.append_row([name, project, status])
            st.success("✅ הדיווח נשלח בהצלחה!")
        except Exception as e:
            st.error(f"שגיאה בשליחה: {e}")
