import streamlit as st
import pandas as pd
from suppliers import get_supplier_names, get_supplier, save_supplier, delete_supplier


def show_supplier_management():
    """ממשק ניהול ספקים ומחירונים"""
    st.header("ניהול ספקים")

    supplier_names = get_supplier_names()

    tab_new, tab_edit = st.tabs(["הוספת ספק חדש", "עריכת ספק קיים"])

    # === טאב הוספת ספק חדש ===
    with tab_new:
        _show_supplier_form(existing_supplier=None)

    # === טאב עריכת ספק קיים ===
    with tab_edit:
        if not supplier_names:
            st.info("אין ספקים במערכת עדיין. הוסף ספק חדש בטאב הראשון.")
            return

        selected = st.selectbox("בחר ספק לעריכה", [""] + supplier_names, key="edit_select")
        if selected:
            supplier_data = get_supplier(selected)
            _show_supplier_form(existing_supplier=supplier_data)

            st.divider()
            if st.button("🗑️ מחק ספק", type="secondary"):
                delete_supplier(selected)
                st.success(f"הספק '{selected}' נמחק")
                st.rerun()


def _show_supplier_form(existing_supplier):
    """טופס הוספה/עריכה של ספק"""
    is_edit = existing_supplier is not None
    prefix = "edit" if is_edit else "new"

    st.subheader("פרטי ספק")

    col1, col2 = st.columns(2)
    with col1:
        name = st.text_input(
            "שם ספק *",
            value=existing_supplier["name"] if is_edit else "",
            key=f"{prefix}_name",
            disabled=is_edit,
        )
        contact_name = st.text_input(
            "איש קשר",
            value=existing_supplier.get("contact_name", "") if is_edit else "",
            key=f"{prefix}_contact",
        )
        phone = st.text_input(
            "טלפון",
            value=existing_supplier.get("phone", "") if is_edit else "",
            key=f"{prefix}_phone",
        )
    with col2:
        email = st.text_input(
            "אימייל",
            value=existing_supplier.get("email", "") if is_edit else "",
            key=f"{prefix}_email",
        )
        address = st.text_input(
            "כתובת",
            value=existing_supplier.get("address", "") if is_edit else "",
            key=f"{prefix}_address",
        )
        notes = st.text_input(
            "הערות",
            value=existing_supplier.get("notes", "") if is_edit else "",
            key=f"{prefix}_notes",
        )

    st.divider()
    st.subheader("מחירון")

    # טעינת מחירון קיים או ריק
    if is_edit and existing_supplier.get("products"):
        products = existing_supplier["products"]
    else:
        products = []

    # אתחול המחירון ב-session_state
    state_key = f"{prefix}_products"
    if state_key not in st.session_state:
        st.session_state[state_key] = products if products else [_empty_product()]

    # הצגת שורות המחירון
    for i, prod in enumerate(st.session_state[state_key]):
        cols = st.columns([2, 4, 2, 2, 1])
        with cols[0]:
            st.session_state[state_key][i]["catalog_number"] = st.text_input(
                "מק\"ט", value=prod.get("catalog_number", ""), key=f"{prefix}_cat_{i}"
            )
        with cols[1]:
            st.session_state[state_key][i]["description"] = st.text_input(
                "תיאור מוצר", value=prod.get("description", ""), key=f"{prefix}_desc_{i}"
            )
        with cols[2]:
            st.session_state[state_key][i]["unit"] = st.text_input(
                "יחידה", value=prod.get("unit", ""), key=f"{prefix}_unit_{i}"
            )
        with cols[3]:
            st.session_state[state_key][i]["price"] = st.number_input(
                "מחיר", min_value=0.0, step=0.01, value=float(prod.get("price", 0)),
                key=f"{prefix}_price_{i}"
            )
        with cols[4]:
            if len(st.session_state[state_key]) > 1:
                if st.button("✕", key=f"{prefix}_del_{i}"):
                    st.session_state[state_key].pop(i)
                    st.rerun()

    # כפתור הוספת שורה
    col_add, col_csv, _ = st.columns([1, 2, 3])
    with col_add:
        if st.button("➕ הוסף מוצר", key=f"{prefix}_add_row"):
            st.session_state[state_key].append(_empty_product())
            st.rerun()

    with col_csv:
        uploaded = st.file_uploader(
            "או טען מחירון מקובץ Excel/CSV",
            type=["csv", "xlsx"],
            key=f"{prefix}_upload",
        )
        if uploaded:
            _import_pricelist(uploaded, state_key)

    st.divider()

    # כפתור שמירה
    btn_label = "עדכן ספק" if is_edit else "שמור ספק חדש"
    if st.button(btn_label, type="primary", key=f"{prefix}_save"):
        if not name:
            st.warning("יש להזין שם ספק")
            return

        # סינון שורות ריקות
        valid_products = [
            p for p in st.session_state[state_key]
            if p.get("description")
        ]

        save_supplier(
            name=name,
            contact_name=contact_name,
            phone=phone,
            email=email,
            address=address,
            notes=notes,
            products=valid_products,
        )

        st.success(f"הספק '{name}' נשמר בהצלחה עם {len(valid_products)} מוצרים!")

        # איפוס הטופס לספק חדש
        if not is_edit:
            st.session_state[state_key] = [_empty_product()]
            st.rerun()


def _empty_product():
    return {"catalog_number": "", "description": "", "unit": "", "price": 0.0}


def _import_pricelist(uploaded_file, state_key):
    """ייבוא מחירון מקובץ CSV או Excel"""
    try:
        if uploaded_file.name.endswith(".csv"):
            df = pd.read_csv(uploaded_file)
        else:
            df = pd.read_excel(uploaded_file)

        # ניסיון למפות עמודות אוטומטית
        col_map = {}
        for col in df.columns:
            col_lower = col.lower().strip()
            if any(k in col_lower for k in ["מקט", "catalog", "קטלוג", "מק\"ט"]):
                col_map["catalog_number"] = col
            elif any(k in col_lower for k in ["תיאור", "description", "שם", "מוצר", "פריט"]):
                col_map["description"] = col
            elif any(k in col_lower for k in ["יחידה", "unit"]):
                col_map["unit"] = col
            elif any(k in col_lower for k in ["מחיר", "price"]):
                col_map["price"] = col

        products = []
        for _, row in df.iterrows():
            products.append({
                "catalog_number": str(row.get(col_map.get("catalog_number", ""), "")),
                "description": str(row.get(col_map.get("description", ""), "")),
                "unit": str(row.get(col_map.get("unit", ""), "")),
                "price": float(row.get(col_map.get("price", ""), 0) or 0),
            })

        if products:
            st.session_state[state_key] = products
            st.success(f"יובאו {len(products)} מוצרים מהקובץ!")
            st.rerun()
        else:
            st.warning("לא נמצאו מוצרים בקובץ")

    except Exception as e:
        st.error(f"שגיאה בקריאת הקובץ: {e}")
