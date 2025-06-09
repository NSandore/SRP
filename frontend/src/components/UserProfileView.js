// src/components/UserProfileView.js

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, Link as RouterLink } from "react-router-dom"; // Using RouterLink for navigation
import "./ProfileView.css";
import DOMPurify from "dompurify";
import { FaCheckCircle } from "react-icons/fa"; // Verification badge icon

function UserProfileView({ userData }) {
  const { user_id } = useParams();
  const [profile, setProfile] = useState(null);

  // Verification states
  const [verified, setVerified] = useState(false);
  const [verifiedCommunityName, setVerifiedCommunityName] = useState("");

  // Ambassador states
  const [ambassadorCommunities, setAmbassadorCommunities] = useState([]);
  const [communityLogos, setCommunityLogos] = useState({}); // { community_id: logo_path }
  const [communityNames, setCommunityNames] = useState({}); // { community_id: name }

  // Follow state for this profile (does the logged-in user follow this profile?)
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollowStatus, setLoadingFollowStatus] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);

  // Log if no userData is passed from the parent
  useEffect(() => {
    if (!userData) {
      console.log("No logged-in user data available.");
    } else {
      console.log("UserProfileView: Received userData:", userData);
    }
  }, [userData]);

  // --------------------------------------------------------------------------
  // Fetch user profile (includes verification and ambassador fields)
  // --------------------------------------------------------------------------
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

          // Check if the user is verified
          if (
            response.data.user.verified === 1 ||
            response.data.user.verified === "1"
          ) {
            console.log(
              `User is verified by community_id: ${response.data.user.verified_community_id}`
            );
            setVerified(true);
          }

          // Check if the user is an ambassador in any communities
          if (response.data.user.community_ambassador_of) {
            let communityIds;
            try {
              communityIds = JSON.parse(response.data.user.community_ambassador_of);
              // Ensure it's an array (if a single value, wrap it in an array)
              if (!Array.isArray(communityIds)) {
                communityIds = [communityIds];
              }
              console.log("Detected ambassador communities:", communityIds);
              setAmbassadorCommunities(communityIds);
              // Fetch logos (and names) for these communities
              fetchCommunityLogos(communityIds);
            } catch (error) {
              console.error(
                "Error parsing community_ambassador_of:",
                error,
                response.data.user.community_ambassador_of
              );
            }
          } else {
            console.log("User is not an ambassador in any communities.");
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

  // --------------------------------------------------------------------------
  // Check follow status: does the logged-in user follow this profile?
  // --------------------------------------------------------------------------
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
        // Note: using 'follower_id' and 'followed_user_id' as required by your API.
        const res = await axios.get(
          `/api/fetch_following_status.php?follower_id=${userData.user_id}&followed_user_id=${user_id}`,
          { withCredentials: true }
        );
        if (res.data.success) {
          // The API returns "isFollowing" in camelCase
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

  // --------------------------------------------------------------------------
  // Fetch follower count for this profile
  // --------------------------------------------------------------------------
  useEffect(() => {
    const fetchFollowerCount = async () => {
      try {
        const res = await axios.get(`/api/fetch_follower_count.php?user_id=${user_id}`);
        if (res.data.success) {
          setFollowerCount(res.data.follower_count);
        }
      } catch (err) {
        console.error('Error fetching follower count:', err);
      }
    };

    fetchFollowerCount();
  }, [user_id]);

  // --------------------------------------------------------------------------
  // Handle follow/unfollow toggle
  // --------------------------------------------------------------------------
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
        } followed_user_id ${parseInt(user_id, 10)}`
      );
      await axios.post(
        `/api/${endpoint}`,
        { follower_id: userData.user_id, followed_user_id: parseInt(user_id, 10) },
        { withCredentials: true }
      );
      setIsFollowing(!isFollowing);
      console.log(`Follow status toggled. New status: ${!isFollowing}`);
    } catch (error) {
      console.error("Error toggling follow status:", error);
    }
  };

  // --------------------------------------------------------------------------
  // Fetch verification community name if user is verified
  // --------------------------------------------------------------------------
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

  // --------------------------------------------------------------------------
  // Fetch community logos (and names) for ambassador communities
  // --------------------------------------------------------------------------
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
          names[communityId] = response.data.community.name; // For tooltip
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

  // If profile is still loading, show a message
  if (!profile) return <p>Loading profile...</p>;

  // Prepare display values
  const fullName = `${profile.first_name} ${profile.last_name}`;
  const displayHeadline = profile.headline || "Student at Your University";
  const displayAbout = profile.about || "No about information provided yet.";
  const displaySkills = profile.skills || "";

  return (
    <div className="profile-view">
      {/* Banner Section */}
      <div className="profile-banner">
        <img
          src={profile.banner_path || "/uploads/banners/default-banner.jpg"}
          alt="Profile Banner"
          className="profile-banner-img"
        />
      </div>

      {/* Header Section */}
      <div className="profile-header">
        <div className="avatar-container">
          <img
            src={profile.avatar_path || "/uploads/avatars/default-avatar.png"}
            alt={`${fullName} Avatar`}
            className="profile-avatar"
          />
        </div>
        <div className="profile-info">
          <h2 className="profile-name">
            {fullName}{" "}
            {verified && (
              <FaCheckCircle
                className="verified-badge"
                style={{ pointerEvents: "auto" }}
                title={`Verified from ${verifiedCommunityName}`}
              />
            )}
          </h2>
          <p className="profile-headline">{displayHeadline}</p>
          <p className="followers-count">{followerCount} Followers</p>

          {/* Follow/Unfollow and Message Buttons (only if viewing another user's profile) */}
          {userData && userData.user_id !== parseInt(user_id, 10) && (
            <div className="profile-actions">
              <button
                className={`follow-button ${isFollowing ? "unfollow" : "follow"}`}
                onClick={handleFollowToggle}
                disabled={loadingFollowStatus}
              >
                {loadingFollowStatus ? "Loading..." : isFollowing ? "Unfollow" : "Follow"}
              </button>
              <button className="message-button">Message</button>
            </div>
          )}

          {/* Display ambassador community logos as clickable links */}
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

      {/* About Section */}
      <div className="profile-section">
        <h3>About</h3>
        <p>{DOMPurify.sanitize(displayAbout)}</p>
      </div>

      {/* Skills Section */}
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
    </div>
  );
}

export default UserProfileView;
