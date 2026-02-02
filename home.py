import streamlit as st

st.set_page_config(page_title="מערכת תעודות משלוח", layout="wide")

from auth import check_login, logout
from shipping_document import show_shipping_document
from supplier_management import show_supplier_management

if not check_login():
    st.stop()

# סרגל עליון
col_title, col_user, col_logout = st.columns([4, 2, 1])
with col_title:
    st.title("מערכת תעודות משלוח")
with col_user:
    st.markdown(f"**משתמש:** {st.session_state.get('username', '')}")
with col_logout:
    logout()

st.divider()

# ניווט בין דפים
page = st.radio("בחר פעולה:", ["תעודת משלוח", "ניהול ספקים"], horizontal=True)

if page == "תעודת משלוח":
    show_shipping_document()
elif page == "ניהול ספקים":
    show_supplier_management()
