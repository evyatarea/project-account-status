import streamlit as st
from accounting_form import show_accounting_form
from meeting_scheduler import show_meeting_scheduler

st.set_page_config(page_title="ניהול פרויקטים", layout="centered")

tab = st.radio("בחר פעולה:", ["הגשת חשבון", "שיבוץ פגישה"])

if tab == "הגשת חשבון":
    show_accounting_form()

elif tab == "שיבוץ פגישה":
    show_meeting_scheduler()
