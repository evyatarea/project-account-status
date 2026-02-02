import streamlit as st

# רשימת משתמשים מורשים - ניתן להרחיב בעתיד
AUTHORIZED_USERS = {
    "admin": "admin123",
    "evyatar": "1234",
}


def check_login():
    """בדיקת התחברות - מחזיר True אם המשתמש מחובר"""
    if st.session_state.get("logged_in"):
        return True

    st.title("כניסה למערכת תעודות משלוח")

    username = st.text_input("שם משתמש")
    password = st.text_input("סיסמה", type="password")

    if st.button("כניסה"):
        if username in AUTHORIZED_USERS and AUTHORIZED_USERS[username] == password:
            st.session_state["logged_in"] = True
            st.session_state["username"] = username
            st.rerun()
        else:
            st.error("שם משתמש או סיסמה שגויים")

    return False


def logout():
    """התנתקות"""
    if st.button("התנתק"):
        st.session_state["logged_in"] = False
        st.session_state["username"] = ""
        st.rerun()
