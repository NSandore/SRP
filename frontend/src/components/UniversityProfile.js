// src/components/UniversityProfile.js
import React, { useState, useEffect } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import axios from "axios";
import "./UniversityProfile.css";

function UniversityProfile({ userData }) {
  const { id } = useParams(); // community id
  const [university, setUniversity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode state (only available if userData.role_id === 3)
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields state
  const [editName, setEditName] = useState("");
  const [editTagline, setEditTagline] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editSecondaryColor, setEditSecondaryColor] = useState("");

  // File upload states for logo and banner
  const [newLogoFile, setNewLogoFile] = useState(null);
  const [newBannerFile, setNewBannerFile] = useState(null);

  // State to control the Ambassador overlay and its data
  const [showAmbassadorOverlay, setShowAmbassadorOverlay] = useState(false);
  const [ambassadors, setAmbassadors] = useState([]);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [errorAmbassadors, setErrorAmbassadors] = useState(null);

  // New state for connections: following and followers (fetched via fetch_connections_list.php)
  const [connections, setConnections] = useState({ following: [], followers: [] });
  const [followersCount, setFollowersCount] = useState(0);

  // For demonstration, we include some mock ambassadors (in addition to fetched ones)
  const mockAmbassadors = [
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1002,
      user_id: 1002,
      first_name: "Bob",
      last_name: "Johnson",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Innovative Leader"
    },
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1001,
      user_id: 1001,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
    {
      id: 1009,
      user_id: 1009,
      first_name: "Alice",
      last_name: "Smith",
      avatar_path: "/uploads/avatars/default-avatar.png",
      headline: "Passionate Educator"
    },
  ];
  const combinedAmbassadors = [...ambassadors, ...mockAmbassadors];

  // --------------------------------------------------------------------------
  // Fetch university details on mount (or when id changes)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchUniversity = async () => {
      try {
        const response = await axios.get(`/api/fetch_university.php?community_id=${id}`);
        if (response.data.success) {
          setUniversity(response.data.university);
          setFollowersCount(response.data.university.followers_count || 0);
          // Initialize editable fields with the current values
          setEditName(response.data.university.name || "");
          setEditTagline(response.data.university.tagline || "");
          setEditLocation(response.data.university.location || "");
          setEditWebsite(response.data.university.website || "");
          setEditPrimaryColor(response.data.university.primary_color || "#0077B5");
          setEditSecondaryColor(response.data.university.secondary_color || "#005f8d");
        } else {
          setError(response.data.error);
        }
      } catch (err) {
        setError("Error fetching university data");
      } finally {
        setLoading(false);
      }
    };
    fetchUniversity();
  }, [id]);

  // --------------------------------------------------------------------------
  // Fetch ambassadors for this community
  // --------------------------------------------------------------------------
  const fetchAmbassadors = async () => {
    setLoadingAmbassadors(true);
    setErrorAmbassadors(null);
    try {
      const response = await axios.get(`/api/fetch_ambassador_list.php?community_id=${id}`);
      if (response.data.success) {
        setAmbassadors(response.data.ambassadors);
      } else {
        setErrorAmbassadors(response.data.error || "Error fetching ambassadors");
      }
    } catch (err) {
      setErrorAmbassadors("Error fetching ambassadors");
    } finally {
      setLoadingAmbassadors(false);
    }
  };

  // --------------------------------------------------------------------------
  // Fetch connections (who the current user follows and who follows them)
  // --------------------------------------------------------------------------
  const fetchConnections = async () => {
    try {
      const response = await axios.get(`/api/fetch_connections_list.php?user_id=${userData.user_id}`, {
        withCredentials: true,
      });
      if (response.data.success) {
        setConnections({
          following: response.data.following, // array of user_ids current user is following
          followers: response.data.followers,   // array of user_ids that follow current user
        });
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  };

  // When the Ambassador overlay is shown, fetch both ambassadors and connections
  useEffect(() => {
    if (showAmbassadorOverlay) {
      fetchAmbassadors();
      fetchConnections();
    }
  }, [showAmbassadorOverlay, id]);

  // Toggle edit mode
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Handle form submission to update university details
  const handleUpdateUniversity = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("community_id", id);
    formData.append("name", editName);
    formData.append("tagline", editTagline);
    formData.append("location", editLocation);
    formData.append("website", editWebsite);
    formData.append("primary_color", editPrimaryColor);
    formData.append("secondary_color", editSecondaryColor);
    if (newLogoFile) {
      formData.append("logo", newLogoFile);
    }
    if (newBannerFile) {
      formData.append("banner", newBannerFile);
    }
    try {
      const response = await axios.post("/api/update_university.php", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.success) {
        alert("University updated successfully!");
        setIsEditing(false);
        setUniversity(response.data.university);
        setNewLogoFile(null);
        setNewBannerFile(null);
      } else {
        alert("Error updating university: " + response.data.error);
      }
    } catch (error) {
      console.error("Error updating university:", error);
      alert("An error occurred while updating the university.");
    }
  };

  // Handle follow/unfollow ambassador
  const handleFollowAmbassador = async (ambassadorUserId) => {
    const isFollowing = connections.following.includes(ambassadorUserId);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await axios.post(
          "/api/unfollow_user.php",
          { follower_id: userData.user_id, followed_user_id: ambassadorUserId },
          { withCredentials: true }
        );
        if (response.data.success) {
          alert("Unfollowed successfully");
        }
      } else {
        // Follow
        const response = await axios.post(
          "/api/follow_user.php",
          { follower_id: userData.user_id, followed_user_id: ambassadorUserId },
          { withCredentials: true }
        );
        if (response.data.success) {
          alert("Followed successfully");
        }
      }
      fetchConnections();
    } catch (error) {
      console.error("Error following/unfollowing user:", error);
      alert("Error following/unfollowing user");
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!university) return <p>No university found.</p>;

  return (
    <div
      className="university-profile"
      style={{
        "--primary-color": university.primary_color || "#0077B5",
        "--secondary-color": university.secondary_color || "#005f8d",
      }}
    >
      {/* University Banner */}
      <div className="university-banner">
        <img
          src={university.banner_path || "/uploads/banners/default-banner.jpeg"}
          alt="University Banner"
        />
      </div>

      <div className="university-logo-container">
        <RouterLink to={`/university/${id}`}>
          <img
            src={university.logo_path || "/uploads/logos/default-logo.png"}
            alt="University Logo"
            className="university-logo"
          />
        </RouterLink>
      </div>

      {isEditing ? (
        <form className="university-edit-form" onSubmit={handleUpdateUniversity}>
          <div className="university-info">
            <div className="logo-section">
              <span>Logo:</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewLogoFile(e.target.files[0])}
              />
            </div>
            <div className="banner-upload-section">
              <span>Banner:</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewBannerFile(e.target.files[0])}
              />
            </div>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="edit-input university-name-input"
              placeholder="University Name"
            />
            <input
              type="text"
              value={editTagline}
              onChange={(e) => setEditTagline(e.target.value)}
              className="edit-input university-tagline-input"
              placeholder="Tagline"
            />
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="edit-input university-location-input"
              placeholder="Location"
            />
            <input
              type="text"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              className="edit-input university-website-input"
              placeholder="Website URL"
            />
            <div className="color-picker-group">
              <label>
                Primary Color:
                <input
                  type="color"
                  value={editPrimaryColor}
                  onChange={(e) => setEditPrimaryColor(e.target.value)}
                />
              </label>
              <label>
                Secondary Color:
                <input
                  type="color"
                  value={editSecondaryColor}
                  onChange={(e) => setEditSecondaryColor(e.target.value)}
                />
              </label>
            </div>
            <div className="edit-buttons">
              <button type="submit" className="save-button">
                Save Changes
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={handleToggleEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="university-info">
          <h1 className="university-name">{university.name}</h1>
          <p className="university-tagline">{university.tagline}</p>
          <p className="university-location">{university.location}</p>
          <p className="followers-count">{followersCount} Followers</p>
          {university.website && (
            <a
              href={university.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Website
            </a>
          )}
          {userData && userData.role_id === 7 && (
            <button
              className="edit-university-button"
              onClick={handleToggleEdit}
            >
              Edit University
            </button>
          )}
          {/* Ambassador List Button */}
          <button
            className="ambassador-button"
            onClick={() => setShowAmbassadorOverlay(true)}
          >
            Ambassador List
          </button>
        </div>
      )}

      {/* Ambassador Overlay */}
      {showAmbassadorOverlay && (
        <div className="overlay">
          <div className="overlay-content">
            <h2>Ambassador List</h2>
            {loadingAmbassadors ? (
              <p>Loading ambassadors...</p>
            ) : errorAmbassadors ? (
              <p>{errorAmbassadors}</p>
            ) : (
              <ul className="ambassador-list">
                {combinedAmbassadors.map((amb) => (
                  <li key={amb.id} className="ambassador-item">
                    <img
                      src={amb.avatar_path || "/uploads/avatars/default-avatar.png"}
                      alt={`${amb.first_name} ${amb.last_name}`}
                      className="ambassador-avatar"
                    />
                    <div className="ambassador-info" style={{ textAlign: 'left' }}>
                      <p className="ambassador-name">
                        <RouterLink to={`/user/${amb.user_id}`}>
                          {amb.first_name} {amb.last_name}
                        </RouterLink>
                        {(() => {
                          if (userData && Number(userData.user_id) === Number(amb.user_id)) {
                            console.log("This ambassador is the logged-in user:", amb);
                            return <span><small> (Me!)</small></span>;
                          }
                          return null;
                        })()}
                        {(() => {
                          if (
                            connections.followers &&
                            connections.followers.includes(Number(amb.user_id))
                          ) {
                            console.log("This ambassador follows you:", amb);
                            return <span className="follows-you"> (Follows you)</span>;
                          }
                          return null;
                        })()}
                      </p>
                      <p className="ambassador-headline">{amb.headline}</p>
                    </div>
                    {/* Only show follow/message buttons if this ambassador isn’t the logged-in user */}
                    {userData && Number(userData.user_id) !== Number(amb.user_id) && (
                      <>
                        {connections.following &&
                        connections.following.includes(Number(amb.user_id)) ? (
                          <button
                            className="follow-button unfollow"
                            onClick={() => handleFollowAmbassador(amb.user_id)}
                          >
                            Unfollow
                          </button>
                        ) : (
                          <button
                            className="follow-button follow"
                            onClick={() => handleFollowAmbassador(amb.user_id)}
                          >
                            Follow
                          </button>
                        )}
                        <RouterLink to={`/messages?user=${amb.user_id}`} className="message-button">
                          Message
                        </RouterLink>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setShowAmbassadorOverlay(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UniversityProfile;
