import streamlit as st
from datetime import datetime
from suppliers import get_supplier_names, get_supplier_products, search_products


def show_shipping_document():
    """טופס תעודת משלוח"""
    st.header("תעודת משלוח")

    # בחירת ספק
    supplier_names = get_supplier_names()
    selected_supplier = st.selectbox("בחר ספק", [""] + supplier_names)

    if not selected_supplier:
        st.info("בחר ספק כדי להתחיל למלא תעודת משלוח")
        return

    # פרטי תעודת משלוח
    col1, col2 = st.columns(2)
    with col1:
        doc_number = st.text_input("מספר תעודת משלוח")
        doc_date = st.date_input("תאריך", value=datetime.now())
    with col2:
        order_number = st.text_input("מספר הזמנה (אופציונלי)")
        notes = st.text_input("הערות")

    st.divider()
    st.subheader(f"פריטים - {selected_supplier}")

    # אתחול שורות בטבלה
    if "rows" not in st.session_state:
        st.session_state["rows"] = [_empty_row()]

    products = get_supplier_products(selected_supplier)
    product_descriptions = [""] + [p["description"] for p in products]

    total_sum = 0.0

    for i, row in enumerate(st.session_state["rows"]):
        with st.container():
            cols = st.columns([1, 4, 1, 2, 2, 1])

            with cols[0]:
                st.text_input("מק\"ט", value=row.get("catalog_number", ""), key=f"cat_{i}", disabled=True)

            with cols[1]:
                # בחירת מוצר מהמחירון עם השלמה אוטומטית
                selected_desc = st.selectbox(
                    "תיאור מוצר",
                    options=product_descriptions,
                    key=f"desc_{i}",
                    index=product_descriptions.index(row["description"]) if row["description"] in product_descriptions else 0,
                )

                # עדכון אוטומטי של שאר השדות כשבוחרים מוצר
                if selected_desc and selected_desc != row.get("description", ""):
                    matched = next((p for p in products if p["description"] == selected_desc), None)
                    if matched:
                        st.session_state["rows"][i]["description"] = matched["description"]
                        st.session_state["rows"][i]["catalog_number"] = matched["catalog_number"]
                        st.session_state["rows"][i]["unit"] = matched["unit"]
                        st.session_state["rows"][i]["price"] = matched["price"]

            with cols[2]:
                unit = st.text_input("יחידה", value=st.session_state["rows"][i].get("unit", ""), key=f"unit_{i}", disabled=True)

            with cols[3]:
                quantity = st.number_input("כמות", min_value=0.0, step=1.0, key=f"qty_{i}", value=float(row.get("quantity", 0)))
                st.session_state["rows"][i]["quantity"] = quantity

            with cols[4]:
                price = st.number_input(
                    "מחיר יחידה",
                    min_value=0.0,
                    step=0.01,
                    key=f"price_{i}",
                    value=float(st.session_state["rows"][i].get("price", 0)),
                )
                st.session_state["rows"][i]["price"] = price

            with cols[5]:
                line_total = quantity * price
                st.text_input("סה\"כ", value=f"{line_total:.2f}", key=f"total_{i}", disabled=True)
                total_sum += line_total

        st.markdown("---")

    # כפתורים להוספה/הסרה
    col_add, col_remove, _ = st.columns([1, 1, 3])
    with col_add:
        if st.button("➕ הוסף שורה"):
            st.session_state["rows"].append(_empty_row())
            st.rerun()
    with col_remove:
        if len(st.session_state["rows"]) > 1:
            if st.button("➖ הסר שורה אחרונה"):
                st.session_state["rows"].pop()
                st.rerun()

    # סיכום
    st.divider()
    st.markdown(f"### סה\"כ תעודת משלוח: **{total_sum:.2f} ₪**")

    # שמירה
    if st.button("שמור תעודת משלוח", type="primary"):
        if not doc_number:
            st.warning("יש להזין מספר תעודת משלוח")
            return

        filled_rows = [r for r in st.session_state["rows"] if r.get("description") and r.get("quantity", 0) > 0]
        if not filled_rows:
            st.warning("יש למלא לפחות שורה אחת עם מוצר וכמות")
            return

        _save_document(
            supplier=selected_supplier,
            doc_number=doc_number,
            doc_date=doc_date,
            order_number=order_number,
            notes=notes,
            rows=filled_rows,
            total=total_sum,
            username=st.session_state.get("username", ""),
        )


def _empty_row():
    return {
        "catalog_number": "",
        "description": "",
        "unit": "",
        "quantity": 0,
        "price": 0.0,
    }


def _save_document(supplier, doc_number, doc_date, order_number, notes, rows, total, username):
    """שמירת תעודת המשלוח - כרגע לקובץ מקומי, בעתיד ל-Google Sheets"""
    try:
        import json
        import os

        document = {
            "supplier": supplier,
            "doc_number": doc_number,
            "doc_date": str(doc_date),
            "order_number": order_number,
            "notes": notes,
            "username": username,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "items": rows,
            "total": total,
        }

        # שמירה לקובץ JSON מקומי
        data_dir = "data"
        os.makedirs(data_dir, exist_ok=True)
        filename = f"{data_dir}/shipping_{doc_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(document, f, ensure_ascii=False, indent=2)

        st.success(f"תעודת משלוח {doc_number} נשמרה בהצלחה!")

        # איפוס הטופס
        st.session_state["rows"] = [_empty_row()]

    except Exception as e:
        st.error(f"שגיאה בשמירה: {e}")
