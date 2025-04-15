import streamlit as st
import pandas as pd
import os
from datetime import datetime

st.set_page_config(page_title="דיווח סטטוס פרויקט", layout="centered")
st.title("📋 טופס סטטוס פרויקט למנהלי פרויקטים")

LOG_FILE = "status_log.xlsx"

@st.cache_data
def load_projects():
    return pd.read_excel("projects.xlsx")
    

project_df = load_projects()

# הכנסת שם המנהל
manager_name = st.text_input("הכנס את שמך (כמו שמופיע ברשימה)")

# בחירת חודש הדיווח
report_month = st.date_input("בחר את תאריך הדיווח (לדוגמה תחילת החודש)", value=datetime.today())

if manager_name:
    relevant_projects = project_df[project_df['manager'].str.lower() == manager_name.lower()]

    if relevant_projects.empty:
        st.warning("לא נמצאו פרויקטים על שמך. בדוק את האיות ונסה שוב.")
    else:
        st.success(f"נמצאו {len(relevant_projects)} פרויקטים עבורך")
        status_entries = []

        for _, row in relevant_projects.iterrows():
            st.subheader(f"📝 פרויקט: {row['Project']} ({row['Customer']})")
            status = st.selectbox(f"סטטוס החשבון בפרויקט '{row['Project']}'?",
                                  ["לא הוגש", "הוגש", "שולם חלקית", "שולם במלואו"],
                                  key=row['Project'])
            amount = st.number_input(f'סכום חשבון לחודש זה (ש"ח):', min_value=0.0,
                                     step=1000.0, key=f"amount_{row['Project']}")
            status_entries.append({
                'Manager': manager_name,
                'Project': row['Project'],
                'Month': report_month.strftime('%Y-%m'),
                'Status': status,
                'Amount': amount
            })

        uploaded_file = st.file_uploader("צרף קובץ חשבון (לא חובה)", type=["xlsx", "xls", "csv", "pdf"])

        if st.button("שלח טופס"):
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            new_data = []
            for entry in status_entries:
                entry['Date'] = datetime.today().strftime('%Y-%m-%d')
                entry['Last Updated'] = timestamp
                entry['File Name'] = uploaded_file.name if uploaded_file else ""
                new_data.append(entry)

            new_df = pd.DataFrame(new_data)

            if os.path.exists(LOG_FILE):
                old_df = pd.read_excel(LOG_FILE)
                # הסרה של שורות ישנות עם אותו Manager + Project + Month
                for _, row in new_df.iterrows():
                    old_df = old_df[~((old_df['Manager'] == row['Manager']) &
                                      (old_df['Project'] == row['Project']) &
                                      (old_df['Month'] == row['Month']))]
                updated_df = pd.concat([old_df, new_df], ignore_index=True)
            else:
                updated_df = new_df

            updated_df.to_excel(LOG_FILE, index=False)
            st.success("הטופס נשלח ונשמר בהצלחה ✅")
            st.write("### סיכום הדיווח שלך:")
            st.dataframe(new_df)
            if uploaded_file:
                with open(f"uploaded_{uploaded_file.name}", "wb") as f:
                    f.write(uploaded_file.read())
                st.info(f"הקובץ נשמר בשם: uploaded_{uploaded_file.name}")
else:
    st.info("אנא הזן את שמך כדי להמשיך.")
