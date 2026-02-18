javascript: (async function () {
  "use strict";

  // Configuration
  const CONFIG = {
    delay: 200,
    filters: {
      minViews: 1,
      skipTitlesWith: ["on vocal", "off vocal", "ニコカラ"]
    },
    colors: {
      add: "#b0e8fc",
      existing: "#8ef990"
    },
    baseUrl: "https://vocadb.net"
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const createButton = (text, color, href) => {
    const btn = document.createElement("a");
    btn.textContent = text;
    btn.href = href;
    btn.target = "_blank";
    btn.addEventListener("click", e => {
      e.stopPropagation();
    });
    Object.assign(btn.style, {
      backgroundColor: color,
      color: "black",
      padding: "7px 14px",
      border: "1px solid black",
      textDecoration: "none",
      display: "inline-block",
      marginLeft: "10px",
      marginTop: "5 px",
      width: "70px",
    });

    return btn;
  };

  const addButtonToElement = (button, videoId) => {
    let position = `a[href="/watch/${videoId}"]`;
    let element = document.querySelector(position);
    if (!element) {
      console.log(
        `First position attempt failed for video id: ${videoId} and position: ${position}`
      );
      position = `a[href="https://www.nicovideo.jp/watch/${videoId}"]`;
      element = document.querySelector(position);
      if (!element) {
        console.log(
          `Second position attempt failed for video id: ${videoId} and position: ${position}`
        );
        position = `a[href="watch/${videoId}"]`;
        element = document.querySelector(position);
        if (!element) {
          throw new Error(
            `No position found for video id: ${videoId} and position: ${position}`
          );
        }
      }
    }
    element.parentElement.parentElement.appendChild(button);
    return true;
  };

  const checkSongInDatabase = async (videoId, service) => {
    console.log(
      `Checking ${service} song in database for video id: ${videoId}`
    );
    const url = `${CONFIG.baseUrl}/api/songs/byPV?pvService=${service}&pvId=${videoId}`;
    console.log("URL: ", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.text();
    return result === "null" ? null : JSON.parse(result);
  };

  const checkPiaproDuplicate = async (pvUrl) => {
    const url = `${CONFIG.baseUrl}/api/songs/findDuplicate?pv[]=${encodeURIComponent(pvUrl)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.matches && result.matches.length > 0
      ? result.matches[0].entry
      : null;
  };

  const addButtonsForNicoVideo = async videoId => {
    const songData = await checkSongInDatabase(videoId, "NicoNicoDouga");
    const nicoBase = (window.location.host === "www.nicolog.jp") ? "nicolog" : "nicovideo";
    const nicoUrl = `https://www.${nicoBase}.jp/watch/${videoId}`;

    if (songData === null) {
      // Video not in database - add "Add" and "Info" buttons
      console.log("Video not in database");
      const addBtn = createButton(
        "Add",
        CONFIG.colors.add,
        `${CONFIG.baseUrl}/Song/Create?pvUrl=${nicoUrl}`
      );

      const infoBtn = createButton(
        "Info",
        CONFIG.colors.add,
        `http://nicodata.vocaloid.eu/?NicoUrl=${nicoUrl}`
      );

      addButtonToElement(addBtn, videoId);
      addButtonToElement(infoBtn, videoId);
    } else {
      // Video exists in database - add "Song Entry" button
      console.log("Video already added");
      const entryBtn = createButton(
        "Song Entry",
        CONFIG.colors.existing,
        `${CONFIG.baseUrl}/S/${songData.id}`
      );

      addButtonToElement(entryBtn, videoId);
    }
  };

  const handleVideoListPage = async () => {
    console.log("Processing video list page...");
    document.querySelectorAll("a").forEach(a => {
      a.onmousedown = null;
      a.onmouseup = null;
      a.addEventListener("click", e => e.stopPropagation(), true);
    });

    let videos = document.querySelectorAll(".grid-area_main .flex-d_column");
    let gridLayout = true;
    if (videos.length === 0) {
      console.error("No videos found! Layout changed?");
      return;
    }

    if (videos.length == 1) {
      console.log("Column layout detected.");
      videos = videos[0].childNodes;
      gridLayout = false;
    }

    for (const video of videos) {
      video.style.border = "1px solid orange";
    }

    for (const video of videos) {
      await sleep(CONFIG.delay);

      console.log("Video:", video);

      if (!video) continue;
      const title = gridLayout
        ? video.childNodes[1].innerText || ""
        : video.childNodes[1].childNodes[0].innerText;

      const views = gridLayout
        ? parseInt(video.childNodes[2].childNodes[1].innerText)
        : parseInt(video.childNodes[1].childNodes[2].childNodes[1].innerText);

      let videoId = gridLayout
        ? video.childNodes[1].href.split("/watch/")[1]
        : video.childNodes[1].childNodes[0].href.split("/watch/")[1];

      videoId = videoId.split("?")[0];
      console.log("Video ID:", videoId);
      if (!videoId) continue;

      if (views < CONFIG.filters.minViews) {
        console.log("Skipping, not enough views:", views);
        continue;
      }

      if (
        CONFIG.filters.skipTitlesWith.some(word =>
          title.toLowerCase().includes(word.toLowerCase())
        )
      ) {
        console.log("Skipping title", title);
        continue;
      }

      await addButtonsForNicoVideo(videoId);
    }
  };

  const resolvePiaproTrackUrl = async (url) => {
    // Already canonical
    if (url.includes("/t/")) {
      const id = url.split("/t/")[1].split(/[?#]/)[0];
      return `https://piapro.jp/t/${id}`;
    }

    // /content/ → resolve to canonical /t/
    if (url.includes("/content/")) {
      // Try canonical link from DOM first (fast path)
      const canonical = document.querySelector("link[rel='canonical']");
      if (canonical && canonical.href.includes("/t/")) {
        const id = canonical.href.split("/t/")[1].split(/[?#]/)[0];
        return `https://piapro.jp/t/${id}`;
      }

      // Fallback: fetch page
      const response = await fetch(url);
      if (!response.ok) return null;
      const html = await response.text();
      const match = html.match(/https:\/\/piapro\.jp\/t\/([^"']+)/);
      if (!match) return null;

      return `https://piapro.jp/t/${match[1]}`;
    }

    return null;
  };


  // Page handlers
  const handleNicologUserPage = async () => {
    console.log("Processing Nicolog User page...");
    const videos = document.querySelectorAll("tr");
    console.log("Videos:", videos);
    if (videos.length === 0) {
      console.error("No videos found! Layout changed?");
      return;
    }

    // start from index 1 (skip table header)
    for (let i = 1; i < videos.length; i++) {
      await sleep(CONFIG.delay);

      const videoId =
        videos[i].childNodes[0].childNodes[0].childNodes[0].href.split(
          "watch/"
        )[1];

      await addButtonsForNicoVideo(videoId);
    }
  };
  const handleNicoChannelVideoPage = async () => {
    console.log("Processing Nico Channel video page...");

    const videos = document.querySelectorAll("a.watchLink");
    if (!videos.length) {
      console.error("No videos found on channel page.");
      return;
    }

    for (const link of videos) {
      await sleep(CONFIG.delay);

      const match = link.href.match(/\/watch\/([^/?]+)/);
      if (!match) continue;

      const videoId = match[1];

      const songData = await checkSongInDatabase(videoId, "NicoNicoDouga");
      const nicoUrl = `https://www.nicovideo.jp/watch/${videoId}`;

      if (songData === null) {
        const addBtn = createButton(
          "Add",
          CONFIG.colors.add,
          `${CONFIG.baseUrl}/Song/Create?pvUrl=${nicoUrl}`
        );

        const infoBtn = createButton(
          "Info",
          CONFIG.colors.add,
          `http://nicodata.vocaloid.eu/?NicoUrl=${nicoUrl}`
        );

        link.parentElement.appendChild(addBtn);
        link.parentElement.appendChild(infoBtn);

      } else {
        const entryBtn = createButton(
          "Song Entry",
          CONFIG.colors.existing,
          `${CONFIG.baseUrl}/S/${songData.id}`
        );

        link.parentElement.appendChild(entryBtn);
      }
    }
  };


  const handleNicoUserPage = async () => {
    console.log("Processing Nico User page...");
    const videos = document.querySelectorAll(
      ".VideoMediaObjectList a.NC-MediaObject-contents"
    );
    if (videos.length === 0) {
      console.error("No videos found! Layout changed?");
      return;
    }

    for (const video of videos) {
      await sleep(CONFIG.delay);

      const videoId = video.href.split("?")[0].split("/")[4];

      await addButtonsForNicoVideo(videoId);
    }
  };

  const handlePiaproUserPage = async () => {
    const links = document.querySelectorAll("a[href*='/t/'], a[href*='/content/']");
    if (!links.length) return;

    for (const link of links) {
      await sleep(CONFIG.delay);

      const normalizedUrl = await resolvePiaproTrackUrl(link.href);
      if (!normalizedUrl) continue;

      const songData = await checkPiaproDuplicate(normalizedUrl);

      if (songData) {
        const entryBtn = createButton(
          "Song Entry",
          CONFIG.colors.existing,
          `${CONFIG.baseUrl}/S/${songData.id}`
        );
        link.parentElement.appendChild(entryBtn);
      } else {
        const addBtn = createButton(
          "Add",
          CONFIG.colors.add,
          `${CONFIG.baseUrl}/Song/Create?pvUrl=${normalizedUrl}`
        );
        link.parentElement.appendChild(addBtn);
      }
    }
  };


  const handleDirectVideoPage = async () => {
    console.log("Processing direct video page...");
    try {
      let videoUrl = window.location.href;
      let service, videoId;
      switch (window.location.host) {
        case "www.nicovideo.jp":
          service = "NicoNicoDouga";
          videoId = videoUrl.split("/watch/")[1];
          break;
        case "music.youtube.com":
        case "www.youtube.com":
          service = "Youtube";
          videoId = videoUrl.split("?v=")[1].split("&")[0];
          break;
        case "piapro.jp": {
          const normalizedUrl = await resolvePiaproTrackUrl(videoUrl);
          if (!normalizedUrl) throw new Error("Unsupported Piapro URL");

          const songData = await checkPiaproDuplicate(normalizedUrl);

          if (songData) {
            window.location.assign(`${CONFIG.baseUrl}/S/${songData.id}`);
          } else {
            window.open(`${CONFIG.baseUrl}/Song/Create?pvUrl=${normalizedUrl}`);
          }
          return;
        }
        default:
          if (window.location.host.endsWith(".bandcamp.com")) {
            service = "Bandcamp";
            const linkedData = JSON.parse(document.querySelector("script[type='application/ld+json']").textContent);
            for (const prop of linkedData.additionalProperty) {
              if (prop.name == "track_id") {
                videoId = prop.value;
              }
            }
            if (videoId === undefined) {
              throw new Error(`Unable to find track_id in Bandcamp data.`);
            }
            break;
          }
          throw new Error(`Unsupported host: ${window.location.host}`);
      }
      const songData = await checkSongInDatabase(videoId, service);

      if (songData) {
        // Redirect to existing song entry
        window.location.assign(`${CONFIG.baseUrl}/S/${songData.id}`);
      } else {
        // Open song creation page
        window.open(`${CONFIG.baseUrl}/Song/Create?pvUrl=${videoUrl}`);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // Main execution logic
  const { host, pathname } = window.location;

  try {
    if (host === "www.nicolog.jp" && (pathname.startsWith("/user/") || pathname.startsWith("/ch/"))) {
      await handleNicologUserPage();
    } else if (
      host === "ch.nicovideo.jp" &&
      pathname.endsWith("/video")
    ) {
      await handleNicoChannelVideoPage();
    } else if (host === "www.nicovideo.jp" && !pathname.startsWith("/watch/")) {
      if (pathname.startsWith("/tag/") || pathname.startsWith("/search/")) {
        await handleVideoListPage();
      } else if (pathname.startsWith("/user/")) {
        await handleNicoUserPage();
      }
    } else if (host === "piapro.jp" && pathname.includes("/content_list/")) {
      await handlePiaproUserPage();
    } else if (
      [
        "www.youtube.com",
        "music.youtube.com",
        "www.nicovideo.jp",
        "piapro.jp",
        /*"vimeo.com",
        "soundcloud.com",
        "www.bilibili.com" */
      ].includes(host)
    ) {
      await handleDirectVideoPage();
    } else if (host.endsWith(".bandcamp.com")) {
      await handleDirectVideoPage();
    } else {
      alert("This bookmarklet is not supported on this website.");
    }
  } catch (error) {
    console.error("Bookmarklet execution failed:", error);
    alert("An error occurred while processing the page.");
  }
})();
