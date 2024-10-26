import React, { useEffect, useState } from 'react';
import './RightPanel.css';

function RightPanel({ refreshCalendar }) {
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    setIframeKey((prevKey) => prevKey + 1);
  }, [refreshCalendar]);

  return (
    <div className="right-panel">
      <iframe
        key={iframeKey}
        src="https://calendar.google.com/calendar/embed?height=500&wkst=2&ctz=Europe%2FWarsaw&bgcolor=%234285F4&showTitle=0&showPrint=0&showTabs=0&showCalendars=0&mode=WEEK&src=YXJpYWRlbnRhbC5vZmZpY2VAZ21haWwuY29t&color=%234285F4"
        style={{ borderWidth: 0 }}
        width="700"
        height="500"
        frameBorder="0"
        scrolling="no"
        title="Kalendarz"
      ></iframe>
    </div>
  );
}

export default RightPanel;
