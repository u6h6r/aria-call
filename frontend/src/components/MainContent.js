import React, { useState, useCallback } from 'react';
import LeftPanel from './LeftPanel';
import RightPanel from './RightPanel';
import './MainContent.css';

function MainContent() {
  const [refreshCalendar, setRefreshCalendar] = useState(false);

  const handleRefreshCalendar = useCallback(() => {
    setRefreshCalendar((prev) => !prev);
  }, []);

  return (
    <div className="main-content">
      <LeftPanel
        onCallEnded={handleRefreshCalendar}
        onRefreshCalendar={handleRefreshCalendar}
      />
      <RightPanel refreshCalendar={refreshCalendar} />
    </div>
  );
}

export default MainContent;
