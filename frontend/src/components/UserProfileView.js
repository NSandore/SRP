// src/components/UserProfileView.js

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useParams, Link as RouterLink } from "react-router-dom";
import "./ProfileView.css";
import DOMPurify from "dompurify";
import { FaCheckCircle, FaEllipsisV } from "react-icons/fa";
import useOnClickOutside from "../hooks/useOnClickOutside";
import ThreadCard from "./ThreadCard";

function UserProfileView({ userData, onFollowNotification, onNotificationsRefresh }) {
  const { user_id } = useParams();
  const [profile, setProfile] = useState(null);

  // Verification states
  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState("");

  // Ambassador states
  const [ambassadorCommunities, setAmbassadorCommunities] = useState([]);
  const [communityLogos, setCommunityLogos] = useState({});
  const [communityNames, setCommunityNames] = useState({});

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollowStatus, setLoadingFollowStatus] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);

  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);
  useOnClickOutside(menuRef, () => setOpenMenu(false));

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState("none");
  const [connectionId, setConnectionId] = useState(null);
  const [isRequester, setIsRequester] = useState(false);

  // Experience & Education states
  const [experience, setExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [loadingEdu, setLoadingEdu] = useState(true);
  const [errorExp, setErrorExp] = useState(null);
  const [errorEdu, setErrorEdu] = useState(null);

  // Profile tabs
  const [activeTab, setActiveTab] = useState("about");
  const [userThreads, setUserThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState(null);
  const [hasLoadedThreads, setHasLoadedThreads] = useState(false);

  useEffect(() => {
    if (!userData) {
      console.log("No logged-in user data available.");
    } else {
      console.log("UserProfileView: Received userData:", userData);
    }
  }, [userData]);

  useEffect(() => {
    setActiveTab("about");
  }, [user_id]);

  useEffect(() => {
    setUserThreads([]);
    setHasLoadedThreads(false);
    setThreadsError(null);
  }, [user_id, userData?.user_id]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        console.log(`Fetching profile for user_id: ${user_id}`);
        const response = await axios.get(`/api/fetch_user.php?user_id=${user_id}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          setProfile(response.data.user);
          console.log("Fetched user profile:", response.data.user);

          // Verified
          if (
            response.data.user.verified === 1 ||
            response.data.user.verified === "1"
          ) {
            console.log(
              `User is verified by community_id: ${response.data.user.verified_community_id}`
            );
            setVerified(true);
          }

          // Ambassador communities
          if (response.data.user.community_ambassador_of) {
            let communityIds;
            try {
              const raw = response.data.user.community_ambassador_of;
              communityIds = typeof raw === "string" ? JSON.parse(raw) : raw;
              if (!Array.isArray(communityIds)) {
                communityIds = [communityIds];
              }
              console.log("Detected ambassador communities:", communityIds);
              setAmbassadorCommunities(communityIds);
              fetchCommunityLogos(communityIds);
            } catch (error) {
              console.error(
                "Error parsing community_ambassador_of:",
                error,
                response.data.user.community_ambassador_of
              );
              setAmbassadorCommunities([]);
            }
          } else {
            console.log("User is not an ambassador in any communities.");
            setAmbassadorCommunities([]);
          }
        } else {
          console.error("Error fetching user:", response.data.error);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    fetchUserProfile();
  }, [user_id]);

  // Check follow status
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!userData || !userData.user_id) {
        console.log("No logged-in user data available for follow status check.");
        setLoadingFollowStatus(false);
        return;
      }
      try {
        console.log(
          `Checking follow status: logged-in user ${userData.user_id} -> target user ${user_id}`
        );
        const res = await axios.get(
          `/api/fetch_following_status.php?follower_id=${userData.user_id}&followed_user_id=${user_id}`,
          { withCredentials: true }
        );
        if (res.data.success) {
          console.log(
            `Follow status for logged-in user ${userData.user_id} on profile ${user_id}:`,
            res.data.isFollowing
          );
          setIsFollowing(res.data.isFollowing);
        } else {
          console.error("Error checking follow status:", res.data.error);
        }
      } catch (err) {
        console.error("Error checking follow status:", err);
      } finally {
        setLoadingFollowStatus(false);
      }
    };

    checkFollowStatus();
  }, [userData, user_id]);

  // Fetch connection status
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      if (!userData || !userData.user_id) return;
      try {
        const res = await axios.get(
          `/api/fetch_connection_status.php?user_id1=${userData.user_id}&user_id2=${user_id}`
        );
        if (res.data.success) {
          setConnectionStatus(res.data.status);
          if (res.data.connection_id) {
            setConnectionId(res.data.connection_id);
            setIsRequester(!!res.data.is_sender);
          } else {
            setConnectionId(null);
            setIsRequester(false);
          }
        }
      } catch (err) {
        console.error("Error fetching connection status:", err);
      }
    };

    fetchConnectionStatus();
  }, [userData, user_id]);

  // Fetch follower count
  useEffect(() => {
    const fetchFollowerCount = async () => {
      try {
        const res = await axios.get(`/api/fetch_follower_count.php?user_id=${user_id}`);
        if (res.data.success) {
          setFollowerCount(res.data.follower_count);
        }
      } catch (err) {
        console.error("Error fetching follower count:", err);
      }
    };

    fetchFollowerCount();
  }, [user_id]);

  // Fetch experience & education
  useEffect(() => {
    setLoadingExp(true);
    axios
      .get(`/api/user_experience.php?user_id=${user_id}`, { withCredentials: true })
      .then((res) => {
        setExperience(res.data);
        setLoadingExp(false);
      })
      .catch((err) => {
        console.error("Error fetching experience:", err);
        setErrorExp("Error fetching experience");
        setLoadingExp(false);
      });

    setLoadingEdu(true);
    axios
      .get(`/api/user_education.php?user_id=${user_id}`, { withCredentials: true })
      .then((res) => {
        setEducation(res.data);
        setLoadingEdu(false);
      })
      .catch((err) => {
        console.error("Error fetching education:", err);
        setErrorEdu("Error fetching education");
        setLoadingEdu(false);
      });
  }, [user_id]);

  // Follow/unfollow
  const handleFollowToggle = async () => {
    if (!userData || !userData.user_id) {
      console.log("Cannot toggle follow status: No logged-in user data.");
      return;
    }
    try {
      const endpoint = isFollowing ? "unfollow_user.php" : "follow_user.php";
      console.log(
        `Sending request to ${endpoint} for follower_id ${userData.user_id} to ${
          isFollowing ? "unfollow" : "follow"
        } followed_user_id ${user_id}`
      );
      await axios.post(
        `/api/${endpoint}`,
        { follower_id: userData.user_id, followed_user_id: user_id },
        { withCredentials: true }
      );
      setIsFollowing(!isFollowing);
      console.log(`Follow status toggled. New status: ${!isFollowing}`);
      if (!isFollowing) {
        onFollowNotification?.(user_id, userData.user_id);
        onNotificationsRefresh?.();
      }
    } catch (error) {
      console.error("Error toggling follow status:", error);
    }
  };

  // Connection actions
  const handleConnect = async () => {
    if (!userData || !userData.user_id) return;
    try {
      const res = await axios.post(
        "/api/request_connection.php",
        { user_id1: userData.user_id, user_id2: user_id },
        { withCredentials: true }
      );
      if (res.data.success) {
        setConnectionStatus("pending");
        if (res.data.connection_id) {
          setConnectionId(res.data.connection_id);
        }
        setIsRequester(true);
      }
    } catch (err) {
      console.error("Error sending connection request:", err);
    }
  };

  const handleAccept = async () => {
    if (!connectionId) return;
    try {
      await axios.post(
        "/api/accept_connection.php",
        { connection_id: connectionId },
        { withCredentials: true }
      );
      setConnectionStatus("accepted");
    } catch (err) {
      console.error("Error accepting connection:", err);
    }
  };

  const handleCancel = async () => {
    if (!connectionId) return;
    try {
      await axios.post(
        "/api/cancel_connection.php",
        { connection_id: connectionId },
        { withCredentials: true }
      );
      setConnectionStatus("none");
      setConnectionId(null);
    } catch (err) {
      console.error("Error cancelling connection:", err);
    }
  };

  const handleRemoveConnection = async () => {
    try {
      await axios.post(
        "/api/remove_connection.php",
        { user_id1: userData.user_id, user_id2: user_id },
        { withCredentials: true }
      );
      setConnectionStatus("none");
      setConnectionId(null);
    } catch (err) {
      console.error("Error removing connection:", err);
    }
  };

  // Fetch verification community name
  useEffect(() => {
    const fetchVerificationCommunity = async (communityId) => {
      console.log(`Fetching verification community name for community_id: ${communityId}`);
      try {
        const res = await axios.get(`/api/fetch_university.php?community_id=${communityId}`);
        if (res.data.success && res.data.university) {
          console.log(`Fetched verification community name: ${res.data.university.name}`);
          setVerifiedCommunityName(res.data.university.name);
        }
      } catch (err) {
        console.error("Error fetching verification community name:", err);
      }
    };

    if (verified && profile && profile.verified_community_id) {
      fetchVerificationCommunity(profile.verified_community_id);
    }
  }, [verified, profile]);

  // Fetch community logos & names for ambassador communities
  const fetchCommunityLogos = async (communityIds) => {
    let logos = {};
    let names = {};

    console.log("Fetching logos for ambassador communities:", communityIds);

    for (let communityId of communityIds) {
      console.log(`Fetching community data for community_id: ${communityId}`);
      try {
        const response = await axios.get(`/api/fetch_community.php?community_id=${communityId}`);
        if (response.data.success && response.data.community) {
          console.log(`Fetched data for community_id ${communityId}:`, response.data.community);
          logos[communityId] = response.data.community.logo_path;
          names[communityId] = response.data.community.name;
        } else {
          console.warn(`No data found for community_id: ${communityId}`);
        }
      } catch (error) {
        console.error(`Error fetching data for community ${communityId}:`, error);
      }
    }

    setCommunityLogos(logos);
    setCommunityNames(names);
  };

  const fetchProfileThreads = async () => {
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      let url = `/api/fetch_user_threads.php?user_id=${user_id}`;
      if (userData?.user_id) {
        url += `&viewer_id=${userData.user_id}`;
      }
      const res = await axios.get(url, { withCredentials: true });
      if (res.data.success) {
        setUserThreads(res.data.threads || []);
      } else {
        setThreadsError(res.data.error || "Unable to load posts.");
      }
    } catch (error) {
      console.error("Error fetching profile threads:", error);
      setThreadsError("Unable to load posts.");
    } finally {
      setThreadsLoading(false);
      setHasLoadedThreads(true);
    }
  };

  useEffect(() => {
    if (activeTab === "posts" && !hasLoadedThreads) {
      fetchProfileThreads();
    }
  }, [activeTab, hasLoadedThreads, user_id, userData?.user_id]);

  if (!profile) return <p>Loading profile...</p>;

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const displayHeadline = profile.headline || "Student at Your University";
  const displayAbout = profile.about || "No about information provided yet.";
  const displaySkills = profile.skills || "";
  const isDefaultAvatar = (profile.avatar_path || "").includes("DefaultAvatar.png");
  const isOwnProfile = userData && Number(userData.user_id) === Number(user_id);
  const hasAcceptedConnection = connectionStatus === "accepted";
  const isPrivateProfile = Number(profile.is_public) === 0;
  const profileVisibility = profile.profile_visibility || "network";
  const isAmbassadorProfile = Number(profile.is_ambassador) === 1;
  const viewerCommunityId = userData?.recent_university_id;
  const ambassadorCommunityIds = Array.isArray(ambassadorCommunities)
    ? ambassadorCommunities.map((c) => Number(c?.community_id ?? c?.id ?? c))
    : [];
  const sharesAmbassadorCommunity =
    Boolean(viewerCommunityId) &&
    ambassadorCommunityIds.some((cid) => Number(cid) === Number(viewerCommunityId));
  const isNetworkRestricted =
    profileVisibility === "network" &&
    isAmbassadorProfile &&
    !isOwnProfile &&
    !hasAcceptedConnection &&
    !sharesAmbassadorCommunity;
  const isRestrictedForPrivacy =
    (profileVisibility === "private" || isPrivateProfile) &&
    !isOwnProfile &&
    !hasAcceptedConnection;
  const shouldBlurDetails = !userData || isRestrictedForPrivacy || isNetworkRestricted;
  const profileTabs = [
    { id: "about", label: "About" },
    { id: "posts", label: "Posts" },
  ];
  const showOnline = Number(profile.show_online ?? 1) === 1 || String(profile.show_online).toLowerCase() === 'true';
  const isOnline =
    showOnline &&
    (profile.is_online === true ||
      profile.is_online === 1 ||
      profile.is_online === '1' ||
      String(profile.is_online).toLowerCase() === 'true');

  return (
    <div className="profile-view profile-container">
      <div className="hero-card profile-hero-card">
        <div className="hero-banner">
          <img
            src={profile.banner_path || "/uploads/banners/DefaultBanner.jpeg"}
            alt="Profile Banner"
          />
        </div>
        <div className="hero-content">
          <div className="hero-left">
            <div className="user-hero-logo-wrap">
              <div className="avatar-presence">
                <img
                  src={profile.avatar_path || "/uploads/avatars/DefaultAvatar.png"}
                  alt={`${fullName} Avatar`}
                  className={`user-hero-logo ${isDefaultAvatar ? "user-hero-logo--default" : ""}`}
                />
                {isOnline && <span className="presence-dot presence-dot--online" title="Online" />}
              </div>
            </div>
            <div className="hero-text">
              <h1 className="hero-title">
                {fullName}
                {verified && (
                  <FaCheckCircle
                    className="verified-badge"
                    style={{ pointerEvents: "auto" }}
                    title={`Verified from ${verifiedCommunityName}`}
                  />
                )}
              </h1>
              <p className="hero-sub">{displayHeadline}</p>
              <p className="hero-sub">{followerCount} Followers</p>
              {ambassadorCommunities.length > 0 && (
                <div className="ambassador-logos">
                  {ambassadorCommunities.map((communityId) => (
                    <RouterLink key={communityId} to={`/university/${communityId}`}>
                      <img
                        src={communityLogos[communityId] || "/uploads/logos/default-logo.png"}
                        alt="Ambassador Community"
                        className="community-logo"
                        title={`${communityNames[communityId] || "Unknown"} Ambassador`}
                      />
                    </RouterLink>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="hero-right hero-actions">
            {userData && userData.user_id !== parseInt(user_id, 10) && (
              <div className="profile-actions" style={{ position: "relative" }}>
                {connectionStatus === "accepted" ? (
                  <RouterLink to={`/messages?user=${user_id}`} className="message-button">
                    Message
                  </RouterLink>
                ) : connectionStatus === "pending" ? (
                  isRequester ? (
                    <button className="connect-button pending" onClick={handleCancel}>
                      Pending
                    </button>
                  ) : (
                    <button className="connect-button" onClick={handleAccept}>
                      Accept
                    </button>
                  )
                ) : (
                  <button className="connect-button" onClick={handleConnect}>
                    Connect
                  </button>
                )}
                <FaEllipsisV
                  className="menu-icon"
                  onClick={() => setOpenMenu((prev) => !prev)}
                  style={{ marginLeft: "8px" }}
                />
                {openMenu && (
                  <div ref={menuRef} className="dropdown-menu" style={{ right: 0 }}>
                    <button
                      className="dropdown-item"
                      onClick={handleFollowToggle}
                      disabled={loadingFollowStatus}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>
                    {connectionStatus === "accepted" && (
                      <button className="dropdown-item" onClick={handleRemoveConnection}>
                        Remove Connection
                      </button>
                    )}
                    <button
                      className="dropdown-item"
                      onClick={() => alert("Report/Block coming soon")}
                    >
                      Report or Block
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="tabs-underline">
          {profileTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-link ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              disabled={shouldBlurDetails}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-detail-wrapper">
        {shouldBlurDetails && (
          <div className="profile-detail-cta">
            <p>
              {isRestrictedForPrivacy
                ? "This user's account is private. Send a connection request to view their info."
                : "Want more details? Log in or create an account to unlock experience, education, and skills."}
            </p>
            <div className="profile-detail-cta-actions">
              {isRestrictedForPrivacy ? (
                connectionStatus === "pending" ? (
                  isRequester ? (
                    <button className="overlay-button ghost" disabled>
                      Request pending
                    </button>
                  ) : (
                    <button className="overlay-button primary" onClick={handleAccept}>
                      Accept request to view
                    </button>
                  )
                ) : (
                  <button className="overlay-button primary" onClick={handleConnect}>
                    Send connection request
                  </button>
                )
              ) : (
                <>
                  <RouterLink to="/login" className="overlay-button primary">
                    Log In
                  </RouterLink>
                  <RouterLink to="/signup" className="overlay-button ghost">
                    Create Account
                  </RouterLink>
                </>
              )}
            </div>
          </div>
        )}

        <div className={`profile-detail-sections ${shouldBlurDetails ? "restricted" : ""}`}>
          {shouldBlurDetails && (
            <div className="profile-detail-overlay" aria-hidden="true"></div>
          )}

          {activeTab === "about" && (
            <>
              <div className={`profile-section about-section ${shouldBlurDetails ? "restricted" : ""}`}>
                <h3>About</h3>
                <p>{DOMPurify.sanitize(displayAbout)}</p>
              </div>

              <div className="profile-section">
                <h3>Experience</h3>
                {loadingExp ? (
                  <p>Loading experience...</p>
                ) : errorExp ? (
                  <p>{errorExp}</p>
                ) : experience.length > 0 ? (
                  experience.map((exp, index) => (
                    <div key={index} className="experience-item">
                      <h4>
                        {exp.title} at {exp.company}
                      </h4>
                      {exp.start_date && (
                        <div className="experience-dates">
                          {exp.start_date} - {exp.end_date ? exp.end_date : "Present"}
                        </div>
                      )}
                      <div className="experience-meta">
                        <span className="experience-type">{exp.employment_type}</span>
                        <span className="experience-location">
                          {exp.location_city}
                          {exp.location_state ? `, ${exp.location_state}` : ""}
                        </span>
                      </div>
                      <p>{exp.description}</p>
                      {exp.responsibilities && exp.responsibilities.length > 0 && (
                        <ul className="responsibilities-list">
                          {exp.responsibilities.map((resp, idx) => (
                            <li key={idx}>{resp}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                ) : (
                  <p>No experience added yet.</p>
                )}
              </div>

              <div className="profile-section">
                <h3>Education</h3>
                {loadingEdu ? (
                  <p>Loading education...</p>
                ) : errorEdu ? (
                  <p>{errorEdu}</p>
                ) : education.length > 0 ? (
                  education.map((edu, index) => (
                    <div key={index} className="education-item">
                      <h4>
                        {edu.degree} in {edu.field_of_study}
                      </h4>
                      <div className="education-institution">{edu.institution}</div>
                      {edu.start_date && (
                        <div className="education-dates">
                          {edu.start_date} - {edu.end_date ? edu.end_date : "Present"}
                        </div>
                      )}
                      {edu.gpa && <div className="education-gpa">GPA: {edu.gpa}</div>}
                      {edu.honors && <div className="education-honors">Honors: {edu.honors}</div>}
                      {edu.activities_societies && (
                        <div className="education-activities">
                          Activities: {edu.activities_societies}
                        </div>
                      )}
                      {edu.achievements && edu.achievements.length > 0 && (
                        <ul className="achievements-list">
                          {edu.achievements.map((ach, idx) => (
                            <li key={idx}>{ach}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))
                ) : (
                  <p>No education details added yet.</p>
                )}
              </div>

              <div className="profile-section">
                <h3>Skills</h3>
                {displaySkills ? (
                  <ul className="skills-list">
                    {displaySkills.split(",").map((skill, index) => (
                      <li key={index} className="skill-item">
                        {skill.trim()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No skills listed yet.</p>
                )}
              </div>
            </>
          )}

          {activeTab === "posts" && (
            <div className="profile-section">
              <h3>Posts</h3>
              {threadsLoading ? (
                <p>Loading posts...</p>
              ) : threadsError ? (
                <p>{threadsError}</p>
              ) : userThreads.length > 0 ? (
                <div className="profile-thread-list">
                  {userThreads.map((thread) => (
                    <ThreadCard key={thread.thread_id} thread={thread} userData={userData} />
                  ))}
                </div>
              ) : (
                <p>No posts yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfileView;
