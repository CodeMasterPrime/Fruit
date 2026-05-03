document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');

  const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  const today = new Date();

  const events = history.flatMap(item => {
    const evts = [];

    const prod = item.dateProduced !== "-"
      ? new Date(item.dateProduced.split('/').reverse().join('-'))
      : null;

    const exp = item.expireDate !== "-"
      ? new Date(item.expireDate.split('/').reverse().join('-'))
      : null;

    if (prod) {
      evts.push({
        title: `🌱 ${item.fruit}`,
        start: prod,
        color: "#81c784",
        extendedProps: {
          fruit: item.fruit,
          produced: item.dateProduced,
          expire: item.expireDate
        }
      });
    }

    if (exp) {
      const diff = Math.ceil((exp - today) / (1000*60*60*24));

      let color = "#e57373";
      let badge = "";

      if (diff < 0) {
        color = "#c62828";
        badge = "Expired";
      } else if (diff <= 3) {
        color = "#ffb74d";
        badge = `D-${diff}`;
      } else {
        color = "#ffcc80";
        badge = `D-${diff}`;
      }

      evts.push({
        title: `⚠️ ${item.fruit} (${badge})`,
        start: exp,
        color: color,
        extendedProps: {
          fruit: item.fruit,
          produced: item.dateProduced,
          expire: item.expireDate,
          remaining: diff
        }
      });
    }

    return evts;
  });

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    firstDay: 1,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,listWeek"
    },
    events: events,

    // ✅ Tooltip
    eventMouseEnter(info) {
      const p = info.event.extendedProps;

      const tooltip = document.createElement("div");
      tooltip.className = "fc-tooltip";
      tooltip.innerHTML = `
        <b>${p.fruit}</b><br>
        🌱 Produced: ${p.produced}<br>
        ⏳ Expire: ${p.expire}<br>
        ${p.remaining !== undefined ? `📅 Days left: ${p.remaining}` : ""}
      `;
      document.body.appendChild(tooltip);

      info.el.addEventListener("mousemove", (e) => {
        tooltip.style.left = e.pageX + 12 + "px";
        tooltip.style.top = e.pageY + 12 + "px";
      });

      info.el.addEventListener("mouseleave", () => tooltip.remove());
    },

    // ✅ Popup on click
    eventClick(info) {
      const p = info.event.extendedProps;

      document.getElementById("modalTitle").textContent = p.fruit;
      document.getElementById("modalProduced").textContent = p.produced;
      document.getElementById("modalExpire").textContent = p.expire;

      document.getElementById("modalDaysLeft").textContent =
        p.remaining !== undefined ? p.remaining : "-";

      document.getElementById("eventModal").classList.add("show");
    }
  });

  calendar.render();
});
