import React from 'react';
import StudentIDCard from './StudentIDCard';
import './ProfilePage.css';

const ProfilePage = ({ student }) => {
  return (
    <div className="profile-page">
      <h1 className="profile-heading">Profile</h1>

      <StudentIDCard
        photoUrl={student.photoUrl}
        name={student.name}
        semester={student.semester}
        branch={student.branch}
        uniqueId={student.uniqueId}
      />

      <p className="profile-note">
        Other settings like books borrowed or profile settings will come
        under the profile card
      </p>
    </div>
  );
};

export default ProfilePage;
